package transactions

import (
	"context"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/hwiyel/whoofolio/app/api/internal/whooing"
)

type Query struct {
	SectionID string
	StartDate string
	EndDate   string
	Limit     int
	Max       string
	Account   string
	AccountID string
	Keyword   string
	Item      string
	Memo      string
}

type Response struct {
	SectionID string               `json:"sectionId"`
	StartDate string               `json:"startDate"`
	EndDate   string               `json:"endDate"`
	Count     int                  `json:"count"`
	Rows      []TransactionSummary `json:"rows"`
}

type TransactionSummary struct {
	EntryID       int64   `json:"entryId"`
	EntryDate     string  `json:"entryDate"`
	LAccount      string  `json:"lAccount"`
	LAccountID    string  `json:"lAccountId"`
	LAccountTitle string  `json:"lAccountTitle"`
	RAccount      string  `json:"rAccount"`
	RAccountID    string  `json:"rAccountId"`
	RAccountTitle string  `json:"rAccountTitle"`
	Item          string  `json:"item"`
	Money         float64 `json:"money"`
	RunningTotal  float64 `json:"runningTotal"`
	Memo          string  `json:"memo"`
}

type Service struct {
	whooingClient whooing.Client
}

func NewService(whooingClient whooing.Client) Service {
	return Service{whooingClient: whooingClient}
}

func (s Service) List(ctx context.Context, now time.Time, query Query) (Response, error) {
	if !s.whooingClient.HasAPIKey() {
		return Response{
			StartDate: defaultStartDate(now),
			EndDate:   now.Format("20060102"),
		}, nil
	}

	sectionID := strings.TrimSpace(query.SectionID)
	if sectionID == "" {
		section, err := s.whooingClient.GetDefaultSection(ctx)
		if err != nil {
			return Response{}, err
		}
		sectionID = section.SectionID
	}

	startDate := strings.TrimSpace(query.StartDate)
	endDate := strings.TrimSpace(query.EndDate)
	if startDate == "" && endDate == "" {
		startDate = defaultStartDate(now)
		endDate = now.Format("20060102")
	}

	params := url.Values{}
	params.Set("section_id", sectionID)
	if startDate != "" {
		params.Set("start_date", startDate)
	}
	if endDate != "" {
		params.Set("end_date", endDate)
	}

	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	params.Set("limit", strconv.Itoa(limit))

	setIfPresent(params, "max", query.Max)
	if strings.TrimSpace(query.AccountID) != "" {
		accountID := strings.TrimSpace(query.AccountID)
		params.Set("account_id", accountID)
		accountGroup, err := s.accountGroupByID(ctx, sectionID, accountID)
		if err != nil {
			return Response{}, err
		}
		if accountGroup != "" {
			params.Set("account", accountGroup)
		}
	} else {
		setIfPresent(params, "account", query.Account)
	}
	setIfPresent(params, "item", query.Item)
	setIfPresent(params, "memo", query.Memo)

	entries, err := s.listEntries(ctx, params, query.Max)
	if err != nil {
		return Response{}, err
	}

	accountTitles, err := s.accountTitlesByID(ctx, sectionID)
	if err != nil {
		return Response{}, err
	}

	keyword := strings.ToLower(strings.TrimSpace(query.Keyword))
	rows := make([]TransactionSummary, 0, len(entries))
	for _, entry := range entries {
		entryItem := entry.Item
		entryMemo := entry.Memo
		if keyword != "" && !matchesKeyword(keyword, entryItem, entryMemo) {
			continue
		}

		rows = append(rows, TransactionSummary{
			EntryID:       entry.EntryID,
			EntryDate:     string(entry.EntryDate),
			LAccount:      entry.LAccount,
			LAccountID:    entry.LAccountID,
			LAccountTitle: displayAccountTitle(accountTitles, entry.LAccountID, entry.LAccount),
			RAccount:      entry.RAccount,
			RAccountID:    entry.RAccountID,
			RAccountTitle: displayAccountTitle(accountTitles, entry.RAccountID, entry.RAccount),
			Item:          entry.Item,
			Money:         float64(entry.Money),
			RunningTotal:  float64(entry.Total),
			Memo:          entry.Memo,
		})
	}

	return Response{
		SectionID: sectionID,
		StartDate: startDate,
		EndDate:   endDate,
		Count:     len(rows),
		Rows:      rows,
	}, nil
}

func (s Service) listEntries(ctx context.Context, baseParams url.Values, requestedMax string) ([]whooing.Entry, error) {
	const maxPages = 8
	const maxRows = 800

	limitValue := 50
	if rawLimit := strings.TrimSpace(baseParams.Get("limit")); rawLimit != "" {
		if parsedLimit, err := strconv.Atoi(rawLimit); err == nil && parsedLimit > 0 {
			limitValue = parsedLimit
		}
	}
	if limitValue > 100 {
		limitValue = 100
	}
	baseParams.Set("limit", strconv.Itoa(limitValue))

	// If caller explicitly requested max, keep one-page behavior.
	if strings.TrimSpace(requestedMax) != "" {
		response, err := s.whooingClient.GetEntries(ctx, baseParams)
		if err != nil {
			return nil, err
		}
		return response.Rows, nil
	}

	// Whooing `max` cursor is unstable on full-range queries without account scope.
	// In that case, do a single wider fetch instead of paginating.
	if strings.TrimSpace(baseParams.Get("account")) == "" && strings.TrimSpace(baseParams.Get("account_id")) == "" {
		response, err := s.whooingClient.GetEntries(ctx, baseParams)
		if err != nil {
			return nil, err
		}
		return response.Rows, nil
	}

	rows := make([]whooing.Entry, 0, limitValue)
	seen := map[int64]bool{}
	currentMax := strings.TrimSpace(baseParams.Get("max"))

	for page := 0; page < maxPages; page++ {
		params := cloneValues(baseParams)
		if currentMax != "" {
			params.Set("max", currentMax)
		} else {
			params.Del("max")
		}

		response, err := s.whooingClient.GetEntries(ctx, params)
		if err != nil {
			return nil, err
		}
		if len(response.Rows) == 0 {
			break
		}

		for _, row := range response.Rows {
			if seen[row.EntryID] {
				continue
			}
			seen[row.EntryID] = true
			rows = append(rows, row)
			if len(rows) >= maxRows {
				return rows, nil
			}
		}

		last := response.Rows[len(response.Rows)-1]
		if len(response.Rows) < limitValue || last.EntryID <= 1 {
			break
		}
		currentMax = strconv.FormatInt(last.EntryID-1, 10)
	}

	return rows, nil
}

func cloneValues(values url.Values) url.Values {
	cloned := url.Values{}
	for key, rows := range values {
		copied := make([]string, len(rows))
		copy(copied, rows)
		cloned[key] = copied
	}
	return cloned
}

func defaultStartDate(now time.Time) string {
	return now.Format("200601") + "01"
}

func setIfPresent(values url.Values, key string, value string) {
	if trimmed := strings.TrimSpace(value); trimmed != "" {
		values.Set(key, trimmed)
	}
}

func (s Service) accountTitlesByID(ctx context.Context, sectionID string) (map[string]string, error) {
	accounts, err := s.whooingClient.GetAccounts(ctx, sectionID)
	if err != nil {
		return nil, err
	}

	titles := map[string]string{}
	addAccountTitles(titles, accounts.Assets)
	addAccountTitles(titles, accounts.Liabilities)
	addAccountTitles(titles, accounts.Capital)
	addAccountTitles(titles, accounts.Expenses)
	addAccountTitles(titles, accounts.Income)

	return titles, nil
}

func (s Service) accountGroupByID(ctx context.Context, sectionID string, accountID string) (string, error) {
	accounts, err := s.whooingClient.GetAccounts(ctx, sectionID)
	if err != nil {
		return "", err
	}

	if hasAccountID(accounts.Assets, accountID) {
		return "assets", nil
	}
	if hasAccountID(accounts.Liabilities, accountID) {
		return "liabilities", nil
	}
	if hasAccountID(accounts.Capital, accountID) {
		return "capital", nil
	}
	if hasAccountID(accounts.Expenses, accountID) {
		return "expenses", nil
	}
	if hasAccountID(accounts.Income, accountID) {
		return "income", nil
	}

	return "", nil
}

func addAccountTitles(titles map[string]string, accounts []whooing.Account) {
	for _, account := range accounts {
		if account.AccountID == "" || account.Title == "" {
			continue
		}
		titles[account.AccountID] = account.Title
	}
}

func hasAccountID(accounts []whooing.Account, accountID string) bool {
	for _, account := range accounts {
		if account.AccountID == accountID {
			return true
		}
	}

	return false
}

func displayAccountTitle(titles map[string]string, accountID string, fallback string) string {
	if title, ok := titles[accountID]; ok && title != "" {
		return title
	}

	return fallback
}

func matchesKeyword(keyword string, item string, memo string) bool {
	itemText := strings.ToLower(strings.TrimSpace(item))
	memoText := strings.ToLower(strings.TrimSpace(memo))

	return strings.Contains(itemText, keyword) || strings.Contains(memoText, keyword)
}
