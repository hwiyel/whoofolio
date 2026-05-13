package reports

import (
	"context"
	"fmt"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/hwiyel/whoofolio/app/api/internal/cache"
	"github.com/hwiyel/whoofolio/app/api/internal/whooing"
)

type MonthlyResponse struct {
	SectionID           string               `json:"sectionId"`
	SectionTitle        string               `json:"sectionTitle"`
	Month               string               `json:"month"`
	Currency            string               `json:"currency"`
	Income              float64              `json:"income"`
	Expense             float64              `json:"expense"`
	NetCashflow         float64              `json:"netCashflow"`
	PrevIncome          float64              `json:"prevIncome"`
	PrevExpense         float64              `json:"prevExpense"`
	PrevNetCashflow     float64              `json:"prevNetCashflow"`
	IncomeDelta         float64              `json:"incomeDelta"`
	ExpenseDelta        float64              `json:"expenseDelta"`
	NetCashflowDelta    float64              `json:"netCashflowDelta"`
	DailyExpenseTrend   []DailyTrendPoint    `json:"dailyExpenseTrend"`
	MonthlyExpenseTrend []MonthlyTrendPoint  `json:"monthlyExpenseTrend"`
	MonthlyIncomeTrend  []MonthlyIncomePoint `json:"monthlyIncomeTrend"`
	ExpenseCategories   []ExpenseCategoryRow `json:"expenseCategories"`
	TopExpenseItems     []ExpenseItem        `json:"topExpenseItems"`
	BigTransactions     []ExpenseEntry       `json:"bigTransactions"`
}

type DailyTrendPoint struct {
	Label             string  `json:"label"`
	CumulativeExpense float64 `json:"cumulativeExpense"`
}

type MonthlyTrendPoint struct {
	Label   string  `json:"label"`
	Expense float64 `json:"expense"`
}

type MonthlyIncomePoint struct {
	Label  string  `json:"label"`
	Income float64 `json:"income"`
}

type ExpenseCategoryRow struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
	Share    float64 `json:"share"`
	Count    int     `json:"count"`
}

type ExpenseItem struct {
	Item   string  `json:"item"`
	Amount float64 `json:"amount"`
	Count  int     `json:"count"`
}

type ExpenseEntry struct {
	EntryID      int64   `json:"entryId"`
	EntryDate    string  `json:"entryDate"`
	Item         string  `json:"item"`
	Amount       float64 `json:"amount"`
	Account      string  `json:"account"`
	AccountID    string  `json:"accountId"`
	AccountTitle string  `json:"accountTitle"`
	Memo         string  `json:"memo"`
}

type Service struct {
	cache         *cache.Memory
	whooingClient whooing.Client
}

func NewService(whooingClient whooing.Client) Service {
	return Service{
		cache:         cache.NewMemory(5 * time.Minute),
		whooingClient: whooingClient,
	}
}

func (s Service) Monthly(ctx context.Context, now time.Time, requestedMonth string) (MonthlyResponse, error) {
	if !s.whooingClient.HasAPIKey() {
		return MonthlyResponse{}, nil
	}

	section, err := s.whooingClient.GetDefaultSection(ctx)
	if err != nil {
		return MonthlyResponse{}, err
	}

	targetMonth := normalizeMonth(requestedMonth, now)
	cacheKey := fmt.Sprintf("reports-monthly:%s:%s", section.SectionID, targetMonth.Format("2006-01"))
	if cached, ok := s.cache.Get(cacheKey); ok {
		if response, ok := cached.(MonthlyResponse); ok {
			return response, nil
		}
	}

	currentStart := firstDayOfMonth(targetMonth)
	currentEnd := lastDayWithinMonth(targetMonth, now)
	prevMonth := currentStart.AddDate(0, -1, 0)
	prevStart := firstDayOfMonth(prevMonth)
	prevEnd := lastDayOfMonth(prevMonth)

	currentSummary, err := s.whooingClient.GetMonthlySummary(
		ctx,
		section.SectionID,
		currentStart.Format("20060102"),
		currentEnd.Format("20060102"),
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	prevSummary, err := s.whooingClient.GetMonthlySummary(
		ctx,
		section.SectionID,
		prevStart.Format("20060102"),
		prevEnd.Format("20060102"),
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	expenseEntries, err := s.listExpenseEntries(
		ctx,
		section.SectionID,
		currentStart.Format("20060102"),
		currentEnd.Format("20060102"),
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	accountMeta, err := s.accountMetaByID(ctx, section.SectionID)
	if err != nil {
		return MonthlyResponse{}, err
	}

	monthlyExpenseTrend, monthlyIncomeTrend, err := s.monthlyTrends(ctx, section.SectionID, currentStart)
	if err != nil {
		return MonthlyResponse{}, err
	}

	dailyExpenseTrend, err := buildDailyExpenseTrend(expenseEntries, currentStart, currentEnd)
	if err != nil {
		return MonthlyResponse{}, err
	}

	expenseCategories := aggregateExpenseCategories(expenseEntries, accountMeta, currentSummary.Expenses)

	response := MonthlyResponse{
		SectionID:           section.SectionID,
		SectionTitle:        section.Title,
		Month:               currentStart.Format("2006-01"),
		Currency:            section.Currency,
		Income:              currentSummary.Income,
		Expense:             currentSummary.Expenses,
		NetCashflow:         currentSummary.NetIncome,
		PrevIncome:          prevSummary.Income,
		PrevExpense:         prevSummary.Expenses,
		PrevNetCashflow:     prevSummary.NetIncome,
		IncomeDelta:         currentSummary.Income - prevSummary.Income,
		ExpenseDelta:        currentSummary.Expenses - prevSummary.Expenses,
		NetCashflowDelta:    currentSummary.NetIncome - prevSummary.NetIncome,
		DailyExpenseTrend:   dailyExpenseTrend,
		MonthlyExpenseTrend: monthlyExpenseTrend,
		MonthlyIncomeTrend:  monthlyIncomeTrend,
		ExpenseCategories:   expenseCategories,
		TopExpenseItems:     aggregateExpenseItems(expenseEntries),
		BigTransactions:     topExpenseTransactions(expenseEntries, accountMeta),
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func (s Service) listExpenseEntries(ctx context.Context, sectionID string, startDate string, endDate string) ([]whooing.Entry, error) {
	const limit = 200
	rows := make([]whooing.Entry, 0, limit)
	seen := map[int64]bool{}
	maxValue := ""

	for page := 0; page < 4; page++ {
		params := url.Values{}
		params.Set("section_id", sectionID)
		params.Set("account", "expenses")
		params.Set("start_date", startDate)
		params.Set("end_date", endDate)
		params.Set("limit", strconv.Itoa(limit))
		if maxValue != "" {
			params.Set("max", maxValue)
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
		}

		last := response.Rows[len(response.Rows)-1]
		if len(response.Rows) < limit || last.EntryID <= 1 {
			break
		}
		maxValue = strconv.FormatInt(last.EntryID-1, 10)
	}

	return rows, nil
}

func (s Service) monthlyTrends(ctx context.Context, sectionID string, targetMonth time.Time) ([]MonthlyTrendPoint, []MonthlyIncomePoint, error) {
	expensePoints := make([]MonthlyTrendPoint, 0, 6)
	incomePoints := make([]MonthlyIncomePoint, 0, 6)
	for offset := 5; offset >= 0; offset-- {
		month := targetMonth.AddDate(0, -offset, 0)
		startDate := firstDayOfMonth(month)
		endDate := lastDayOfMonth(month)

		summary, err := s.whooingClient.GetMonthlySummary(
			ctx,
			sectionID,
			startDate.Format("20060102"),
			endDate.Format("20060102"),
		)
		if err != nil {
			return nil, nil, err
		}

		expensePoints = append(expensePoints, MonthlyTrendPoint{
			Label:   month.Format("06.01"),
			Expense: summary.Expenses,
		})
		incomePoints = append(incomePoints, MonthlyIncomePoint{
			Label:  month.Format("06.01"),
			Income: summary.Income,
		})
	}

	return expensePoints, incomePoints, nil
}

func aggregateExpenseCategories(entries []whooing.Entry, accountMeta map[string]accountMeta, totalExpense float64) []ExpenseCategoryRow {
	aggregated := map[string]*ExpenseCategoryRow{}
	for _, entry := range entries {
		category := expenseCategoryTitle(entry, accountMeta)
		if _, ok := aggregated[category]; !ok {
			aggregated[category] = &ExpenseCategoryRow{Category: category}
		}

		aggregated[category].Amount += float64(entry.Money)
		aggregated[category].Count++
	}

	rows := make([]ExpenseCategoryRow, 0, len(aggregated))
	for _, row := range aggregated {
		if totalExpense > 0 {
			row.Share = (row.Amount / totalExpense) * 100
		}
		rows = append(rows, *row)
	}

	sort.Slice(rows, func(i int, j int) bool {
		if rows[i].Amount == rows[j].Amount {
			return rows[i].Category < rows[j].Category
		}
		return rows[i].Amount > rows[j].Amount
	})

	return rows
}

func buildDailyExpenseTrend(entries []whooing.Entry, startDate time.Time, endDate time.Time) ([]DailyTrendPoint, error) {
	dailySums := map[string]float64{}
	for _, entry := range entries {
		amount := float64(entry.Money)
		if amount <= 0 {
			continue
		}

		entryDate, err := parseEntryDate(string(entry.EntryDate))
		if err != nil {
			return nil, err
		}
		key := entryDate.Format("2006-01-02")
		dailySums[key] += amount
	}

	points := make([]DailyTrendPoint, 0)
	cumulative := 0.0
	for current := startDate; !current.After(endDate); current = current.AddDate(0, 0, 1) {
		key := current.Format("2006-01-02")
		cumulative += dailySums[key]
		points = append(points, DailyTrendPoint{
			Label:             current.Format("01.02"),
			CumulativeExpense: cumulative,
		})
	}

	return points, nil
}

func aggregateExpenseItems(entries []whooing.Entry) []ExpenseItem {
	aggregated := map[string]*ExpenseItem{}
	for _, entry := range entries {
		item := strings.TrimSpace(entry.Item)
		if item == "" {
			item = "미분류"
		}

		if _, ok := aggregated[item]; !ok {
			aggregated[item] = &ExpenseItem{Item: item}
		}
		aggregated[item].Amount += float64(entry.Money)
		aggregated[item].Count++
	}

	rows := make([]ExpenseItem, 0, len(aggregated))
	for _, item := range aggregated {
		rows = append(rows, *item)
	}

	sort.Slice(rows, func(i int, j int) bool {
		if rows[i].Amount == rows[j].Amount {
			return rows[i].Item < rows[j].Item
		}
		return rows[i].Amount > rows[j].Amount
	})

	if len(rows) > 6 {
		return rows[:6]
	}

	return rows
}

func topExpenseTransactions(entries []whooing.Entry, accountMeta map[string]accountMeta) []ExpenseEntry {
	rows := make([]ExpenseEntry, 0, len(entries))
	for _, entry := range entries {
		categoryAccountID, categoryGroup := expenseCategoryAccount(entry, accountMeta)
		rows = append(rows, ExpenseEntry{
			EntryID:      entry.EntryID,
			EntryDate:    string(entry.EntryDate),
			Item:         entry.Item,
			Amount:       float64(entry.Money),
			Account:      categoryGroup,
			AccountID:    categoryAccountID,
			AccountTitle: displayAccountTitle(accountMeta, categoryAccountID, entry.LAccount),
			Memo:         entry.Memo,
		})
	}

	sort.Slice(rows, func(i int, j int) bool {
		return rows[i].Amount > rows[j].Amount
	})

	if len(rows) > 8 {
		return rows[:8]
	}

	return rows
}

type accountMeta struct {
	Title string
	Group string
}

func (s Service) accountMetaByID(ctx context.Context, sectionID string) (map[string]accountMeta, error) {
	accounts, err := s.whooingClient.GetAccounts(ctx, sectionID)
	if err != nil {
		return nil, err
	}

	meta := map[string]accountMeta{}
	addAccountMeta(meta, accounts.Assets, "assets")
	addAccountMeta(meta, accounts.Liabilities, "liabilities")
	addAccountMeta(meta, accounts.Capital, "capital")
	addAccountMeta(meta, accounts.Expenses, "expenses")
	addAccountMeta(meta, accounts.Income, "income")

	return meta, nil
}

func addAccountMeta(meta map[string]accountMeta, accounts []whooing.Account, group string) {
	for _, account := range accounts {
		if account.AccountID == "" {
			continue
		}
		meta[account.AccountID] = accountMeta{
			Title: account.Title,
			Group: group,
		}
	}
}

func expenseCategoryTitle(entry whooing.Entry, accountMeta map[string]accountMeta) string {
	accountID, _ := expenseCategoryAccount(entry, accountMeta)
	if accountID == "" {
		item := strings.TrimSpace(entry.Item)
		if item == "" {
			return "미분류"
		}
		return item
	}

	return displayAccountTitle(accountMeta, accountID, "미분류")
}

func expenseCategoryAccount(entry whooing.Entry, accountMeta map[string]accountMeta) (string, string) {
	if meta, ok := accountMeta[entry.LAccountID]; ok && meta.Group == "expenses" {
		return entry.LAccountID, meta.Group
	}
	if meta, ok := accountMeta[entry.RAccountID]; ok && meta.Group == "expenses" {
		return entry.RAccountID, meta.Group
	}
	return "", ""
}

func displayAccountTitle(meta map[string]accountMeta, accountID string, fallback string) string {
	if item, ok := meta[accountID]; ok && strings.TrimSpace(item.Title) != "" {
		return item.Title
	}

	return fallback
}

func normalizeMonth(value string, now time.Time) time.Time {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return now
	}

	parsed, err := time.Parse("2006-01", trimmed)
	if err != nil {
		return now
	}

	return parsed
}

func parseEntryDate(value string) (time.Time, error) {
	base := strings.Split(value, ".")[0]
	return time.Parse("20060102", base)
}

func firstDayOfMonth(value time.Time) time.Time {
	return time.Date(value.Year(), value.Month(), 1, 0, 0, 0, 0, value.Location())
}

func lastDayOfMonth(value time.Time) time.Time {
	return firstDayOfMonth(value).AddDate(0, 1, -1)
}

func lastDayWithinMonth(target time.Time, now time.Time) time.Time {
	if target.Year() == now.Year() && target.Month() == now.Month() {
		return now
	}

	return lastDayOfMonth(target)
}
