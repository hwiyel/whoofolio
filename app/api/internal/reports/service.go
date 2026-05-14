package reports

import (
	"context"
	"fmt"
	"sort"
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
	DailyCashflowTrend  []DailyCashflowPoint `json:"dailyCashflowTrend"`
	MonthlyExpenseTrend []MonthlyTrendPoint  `json:"monthlyExpenseTrend"`
	MonthlyIncomeTrend  []MonthlyIncomePoint `json:"monthlyIncomeTrend"`
	ExpenseCategories   []ExpenseCategoryRow `json:"expenseCategories"`
	IncomeCategories    []ExpenseCategoryRow `json:"incomeCategories"`
}

type DailyCashflowPoint struct {
	Label   string  `json:"label"`
	Expense float64 `json:"expense"`
	Income  float64 `json:"income"`
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
	Category string        `json:"category"`
	Amount   float64       `json:"amount"`
	Share    float64       `json:"share"`
	Items    []ExpenseItem `json:"items"`
}

type ExpenseItem struct {
	Item   string  `json:"item"`
	Amount float64 `json:"amount"`
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

	accountMeta, err := s.accountMetaByID(ctx, section.SectionID)
	if err != nil {
		return MonthlyResponse{}, err
	}

	monthlyExpenseTrend, monthlyIncomeTrend, err := s.monthlyTrends(ctx, section.SectionID, currentStart)
	if err != nil {
		return MonthlyResponse{}, err
	}

	dailyCashflowTrend, err := s.dailyCashflowTrend(ctx, section.SectionID, currentStart, currentEnd, accountMeta)
	if err != nil {
		return MonthlyResponse{}, err
	}

	expenseCategories, err := s.categoryBreakdownByWhooing(
		ctx,
		section.SectionID,
		"expenses",
		currentStart.Format("20060102"),
		currentEnd.Format("20060102"),
		currentSummary.Expenses,
		accountMeta,
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	incomeCategories, err := s.categoryBreakdownByWhooing(
		ctx,
		section.SectionID,
		"income",
		currentStart.Format("20060102"),
		currentEnd.Format("20060102"),
		currentSummary.Income,
		accountMeta,
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

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
		DailyCashflowTrend:  dailyCashflowTrend,
		MonthlyExpenseTrend: monthlyExpenseTrend,
		MonthlyIncomeTrend:  monthlyIncomeTrend,
		ExpenseCategories:   expenseCategories,
		IncomeCategories:    incomeCategories,
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func (s Service) monthlyTrends(ctx context.Context, sectionID string, targetMonth time.Time) ([]MonthlyTrendPoint, []MonthlyIncomePoint, error) {
	expensePoints := make([]MonthlyTrendPoint, 0, 24)
	incomePoints := make([]MonthlyIncomePoint, 0, 24)
	for offset := 23; offset >= 0; offset-- {
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

func (s Service) categoryBreakdownByWhooing(
	ctx context.Context,
	sectionID string,
	group string,
	startDate string,
	endDate string,
	totalAmount float64,
	accountMeta map[string]accountMeta,
) ([]ExpenseCategoryRow, error) {
	categoryTotals, err := s.whooingClient.GetAccountIDsOfAccount(ctx, sectionID, group, startDate, endDate)
	if err != nil {
		return nil, err
	}

	totalByCategoryName := map[string]float64{}
	for _, row := range categoryTotals {
		category := strings.TrimSpace(row.Name)
		if category == "" {
			continue
		}
		totalByCategoryName[category] = float64(row.Money)
	}

	rows := make([]ExpenseCategoryRow, 0, len(totalByCategoryName))
	for accountID, meta := range accountMeta {
		if meta.Group != group {
			continue
		}

		category := strings.TrimSpace(meta.Title)
		if category == "" {
			continue
		}

		itemsSummary, err := s.whooingClient.GetItemsOfAccountID(
			ctx,
			sectionID,
			group,
			accountID,
			startDate,
			endDate,
		)
		if err != nil {
			return nil, err
		}

		items := make([]ExpenseItem, 0, len(itemsSummary))
		itemsTotal := 0.0
		for _, item := range itemsSummary {
			name := strings.TrimSpace(item.Name)
			if name == "" {
				name = "미분류"
			}
			amount := float64(item.Money)
			itemsTotal += amount
			items = append(items, ExpenseItem{
				Item:   name,
				Amount: amount,
			})
		}

		sort.Slice(items, func(i int, j int) bool {
			if items[i].Amount == items[j].Amount {
				return items[i].Item < items[j].Item
			}
			return items[i].Amount > items[j].Amount
		})

		amount, ok := totalByCategoryName[category]
		if !ok {
			amount = itemsTotal
		}
		if amount == 0 && len(items) == 0 {
			continue
		}

		row := ExpenseCategoryRow{
			Category: category,
			Amount:   amount,
			Items:    items,
		}
		if totalAmount > 0 {
			row.Share = (row.Amount / totalAmount) * 100
		}
		rows = append(rows, row)
	}

	sort.Slice(rows, func(i int, j int) bool {
		if rows[i].Amount == rows[j].Amount {
			return rows[i].Category < rows[j].Category
		}
		return rows[i].Amount > rows[j].Amount
	})

	return rows, nil
}

func (s Service) dailyCashflowTrend(
	ctx context.Context,
	sectionID string,
	startDate time.Time,
	endDate time.Time,
	accountMeta map[string]accountMeta,
) ([]DailyCashflowPoint, error) {
	expenseDailySums, err := s.accountGroupDailySums(ctx, sectionID, "expenses", startDate, endDate, accountMeta)
	if err != nil {
		return nil, err
	}

	incomeDailySums, err := s.accountGroupDailySums(ctx, sectionID, "income", startDate, endDate, accountMeta)
	if err != nil {
		return nil, err
	}

	points := make([]DailyCashflowPoint, 0, int(endDate.Sub(startDate).Hours()/24)+1)
	for current := startDate; !current.After(endDate); current = current.AddDate(0, 0, 1) {
		key := current.Format("2006-01-02")
		points = append(points, DailyCashflowPoint{
			Label:   current.Format("01.02"),
			Expense: expenseDailySums[key],
			Income:  incomeDailySums[key],
		})
	}

	return points, nil
}

func (s Service) accountGroupDailySums(
	ctx context.Context,
	sectionID string,
	group string,
	startDate time.Time,
	endDate time.Time,
	accountMeta map[string]accountMeta,
) (map[string]float64, error) {
	dailySums := map[string]float64{}
	start := startDate.Format("20060102")
	end := endDate.Format("20060102")

	for accountID, meta := range accountMeta {
		if meta.Group != group || strings.TrimSpace(accountID) == "" {
			continue
		}

		changes, err := s.whooingClient.GetChangesOfAccountID(ctx, sectionID, group, accountID, start, end)
		if err != nil {
			return nil, err
		}

		for _, row := range changes.Rows {
			changeDate, err := parseEntryDate(string(row.Date))
			if err != nil {
				return nil, err
			}

			key := changeDate.Format("2006-01-02")
			dailySums[key] += float64(row.Money)
		}
	}

	return dailySums, nil
}

func expenseItemTitle(item string) string {
	normalized := strings.TrimSpace(item)
	if normalized == "" {
		return "미분류"
	}

	return normalized
}

func expenseItemGroupTitle(item string) string {
	normalized := strings.TrimSpace(item)
	if normalized == "" {
		return "미분류"
	}

	index := strings.Index(normalized, "(")
	if index <= 0 {
		return normalized
	}

	group := strings.TrimSpace(normalized[:index])
	if group == "" {
		return normalized
	}

	return group
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
