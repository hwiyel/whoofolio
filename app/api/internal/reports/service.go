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
	SectionID            string               `json:"sectionId"`
	SectionTitle         string               `json:"sectionTitle"`
	Month                string               `json:"month"`
	Currency             string               `json:"currency"`
	Income               float64              `json:"income"`
	Expense              float64              `json:"expense"`
	NetCashflow          float64              `json:"netCashflow"`
	PrevIncome           float64              `json:"prevIncome"`
	PrevExpense          float64              `json:"prevExpense"`
	PrevNetCashflow      float64              `json:"prevNetCashflow"`
	IncomeDelta          float64              `json:"incomeDelta"`
	ExpenseDelta         float64              `json:"expenseDelta"`
	NetCashflowDelta     float64              `json:"netCashflowDelta"`
	DailyCashflowTrend   []DailyCashflowPoint `json:"dailyCashflowTrend"`
	MonthlyExpenseTrend  []MonthlyTrendPoint  `json:"monthlyExpenseTrend"`
	MonthlyIncomeTrend   []MonthlyIncomePoint `json:"monthlyIncomeTrend"`
	ExpenseCategories    []ExpenseCategoryRow `json:"expenseCategories"`
	IncomeCategories     []ExpenseCategoryRow `json:"incomeCategories"`
	YearlyIncomeSources  []YearlySourceRow    `json:"yearlyIncomeSources"`
	YearlyExpenseSources []YearlySourceRow    `json:"yearlyExpenseSources"`
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

type YearlySourceRow struct {
	Year            string             `json:"year"`
	TopSource       string             `json:"topSource"`
	TopSourceAmount float64            `json:"topSourceAmount"`
	TopSourceShare  float64            `json:"topSourceShare"`
	TotalAmount     float64            `json:"totalAmount"`
	Sources         []YearlySourceItem `json:"sources"`
}

type YearlySourceItem struct {
	Source string  `json:"source"`
	Amount float64 `json:"amount"`
	Share  float64 `json:"share"`
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
	trendStart := firstDayOfMonth(currentStart.AddDate(0, -35, 0))
	monthlyTrendRows, err := s.whooingClient.GetIncomeExpenseTrend(
		ctx,
		section.SectionID,
		"month",
		trendStart.Format("200601"),
		currentEnd.Format("20060102"),
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	currentSummary := summaryFromTrendRow(monthlyTrendRows.Rows[currentStart.Format("200601")])
	prevSummary := summaryFromTrendRow(monthlyTrendRows.Rows[prevMonth.Format("200601")])

	accountMeta, err := s.accountMetaByID(ctx, section.SectionID)
	if err != nil {
		return MonthlyResponse{}, err
	}

	yearlyIncomeSources, err := s.yearlyIncomeSources(ctx, section.SectionID, currentStart, currentEnd, accountMeta)
	if err != nil {
		return MonthlyResponse{}, err
	}
	yearlyExpenseSources, err := s.yearlyExpenseSources(ctx, section.SectionID, currentStart, currentEnd, accountMeta)
	if err != nil {
		return MonthlyResponse{}, err
	}

	monthlyExpenseTrend, monthlyIncomeTrend := s.monthlyTrends(monthlyTrendRows.Rows, currentStart)
	dailyTrendRows, err := s.whooingClient.GetIncomeExpenseTrend(
		ctx,
		section.SectionID,
		"day",
		currentStart.Format("20060102"),
		currentEnd.Format("20060102"),
	)
	if err != nil {
		return MonthlyResponse{}, err
	}

	dailyCashflowTrend := s.dailyCashflowTrend(dailyTrendRows.Rows, currentStart, currentEnd)

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
		SectionID:            section.SectionID,
		SectionTitle:         section.Title,
		Month:                currentStart.Format("2006-01"),
		Currency:             section.Currency,
		Income:               currentSummary.Income,
		Expense:              currentSummary.Expenses,
		NetCashflow:          currentSummary.NetIncome,
		PrevIncome:           prevSummary.Income,
		PrevExpense:          prevSummary.Expenses,
		PrevNetCashflow:      prevSummary.NetIncome,
		IncomeDelta:          currentSummary.Income - prevSummary.Income,
		ExpenseDelta:         currentSummary.Expenses - prevSummary.Expenses,
		NetCashflowDelta:     currentSummary.NetIncome - prevSummary.NetIncome,
		DailyCashflowTrend:   dailyCashflowTrend,
		MonthlyExpenseTrend:  monthlyExpenseTrend,
		MonthlyIncomeTrend:   monthlyIncomeTrend,
		ExpenseCategories:    expenseCategories,
		IncomeCategories:     incomeCategories,
		YearlyIncomeSources:  yearlyIncomeSources,
		YearlyExpenseSources: yearlyExpenseSources,
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func (s Service) monthlyTrends(rows map[string]whooing.ReportSummaryTrendRow, targetMonth time.Time) ([]MonthlyTrendPoint, []MonthlyIncomePoint) {
	expensePoints := make([]MonthlyTrendPoint, 0, 36)
	incomePoints := make([]MonthlyIncomePoint, 0, 36)
	for offset := 35; offset >= 0; offset-- {
		month := targetMonth.AddDate(0, -offset, 0)
		row := rows[month.Format("200601")]

		expensePoints = append(expensePoints, MonthlyTrendPoint{
			Label:   month.Format("06.01"),
			Expense: float64(row.Expenses),
		})
		incomePoints = append(incomePoints, MonthlyIncomePoint{
			Label:  month.Format("06.01"),
			Income: float64(row.Income),
		})
	}

	return expensePoints, incomePoints
}

func (s Service) yearlyIncomeSources(
	ctx context.Context,
	sectionID string,
	currentStart time.Time,
	currentEnd time.Time,
	accountMeta map[string]accountMeta,
) ([]YearlySourceRow, error) {
	startOfRange := time.Date(currentStart.Year()-2, time.January, 1, 0, 0, 0, 0, currentStart.Location())
	endOfRange := time.Date(currentEnd.Year(), currentEnd.Month(), currentEnd.Day(), 0, 0, 0, 0, currentEnd.Location())
	report, err := s.whooingClient.GetAccountReport(
		ctx,
		sectionID,
		"income",
		"year",
		startOfRange.Format("200601"),
		endOfRange.Format("20060102"),
	)
	if err != nil {
		return nil, err
	}

	rows := make([]YearlySourceRow, 0, 3)
	for year := currentStart.Year() - 2; year <= currentStart.Year(); year++ {
		row, ok := report.Rows[fmt.Sprintf("%04d", year)]
		if !ok || row.Income == nil {
			rows = append(rows, YearlySourceRow{Year: fmt.Sprintf("%04d", year)})
			continue
		}

		totalAmount := float64(row.Income.Total)
		sources := make([]YearlySourceItem, 0, len(row.Income.Accounts))
		topSource := ""
		topAmount := 0.0
		for accountID, amountValue := range row.Income.Accounts {
			meta, ok := accountMeta[accountID]
			if !ok || meta.Group != "income" || meta.Type != "account" {
				continue
			}

			amount := float64(amountValue)
			title := incomeSourceTitle(accountMeta, accountID)
			share := 0.0
			if totalAmount > 0 {
				share = (amount / totalAmount) * 100
			}
			sources = append(sources, YearlySourceItem{
				Source: title,
				Amount: amount,
				Share:  share,
			})
			if amount > topAmount || (amount == topAmount && topSource != "" && title < topSource) {
				topSource = title
				topAmount = amount
			}
		}
		sort.Slice(sources, func(i int, j int) bool {
			if sources[i].Amount == sources[j].Amount {
				return sources[i].Source < sources[j].Source
			}
			return sources[i].Amount > sources[j].Amount
		})
		if len(sources) > 5 {
			sources = sources[:5]
		}

		share := 0.0
		if totalAmount > 0 {
			share = (topAmount / totalAmount) * 100
		}

		rows = append(rows, YearlySourceRow{
			Year:            fmt.Sprintf("%04d", year),
			TopSource:       topSource,
			TopSourceAmount: topAmount,
			TopSourceShare:  share,
			TotalAmount:     totalAmount,
			Sources:         sources,
		})
	}

	return rows, nil
}

func (s Service) yearlyExpenseSources(
	ctx context.Context,
	sectionID string,
	currentStart time.Time,
	currentEnd time.Time,
	accountMeta map[string]accountMeta,
) ([]YearlySourceRow, error) {
	startOfRange := time.Date(currentStart.Year()-2, time.January, 1, 0, 0, 0, 0, currentStart.Location())
	endOfRange := time.Date(currentEnd.Year(), currentEnd.Month(), currentEnd.Day(), 0, 0, 0, 0, currentEnd.Location())
	report, err := s.whooingClient.GetAccountReport(
		ctx,
		sectionID,
		"expenses",
		"year",
		startOfRange.Format("200601"),
		endOfRange.Format("20060102"),
	)
	if err != nil {
		return nil, err
	}

	rows := make([]YearlySourceRow, 0, 3)
	for year := currentStart.Year() - 2; year <= currentStart.Year(); year++ {
		row, ok := report.Rows[fmt.Sprintf("%04d", year)]
		if !ok || row.Expense == nil {
			rows = append(rows, YearlySourceRow{Year: fmt.Sprintf("%04d", year)})
			continue
		}

		totalAmount := float64(row.Expense.Total)
		sources := make([]YearlySourceItem, 0, len(row.Expense.Accounts))
		topSource := ""
		topAmount := 0.0
		for accountID, amountValue := range row.Expense.Accounts {
			meta, ok := accountMeta[accountID]
			if !ok || meta.Group != "expenses" || meta.Type != "account" {
				continue
			}

			amount := float64(amountValue)
			title := expenseSourceTitle(accountMeta, accountID)
			share := 0.0
			if totalAmount > 0 {
				share = (amount / totalAmount) * 100
			}
			sources = append(sources, YearlySourceItem{
				Source: title,
				Amount: amount,
				Share:  share,
			})
			if amount > topAmount || (amount == topAmount && topSource != "" && title < topSource) {
				topSource = title
				topAmount = amount
			}
		}
		sort.Slice(sources, func(i int, j int) bool {
			if sources[i].Amount == sources[j].Amount {
				return sources[i].Source < sources[j].Source
			}
			return sources[i].Amount > sources[j].Amount
		})
		if len(sources) > 5 {
			sources = sources[:5]
		}

		share := 0.0
		if totalAmount > 0 {
			share = (topAmount / totalAmount) * 100
		}

		rows = append(rows, YearlySourceRow{
			Year:            fmt.Sprintf("%04d", year),
			TopSource:       topSource,
			TopSourceAmount: topAmount,
			TopSourceShare:  share,
			TotalAmount:     totalAmount,
			Sources:         sources,
		})
	}

	return rows, nil
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

func (s Service) dailyCashflowTrend(rows map[string]whooing.ReportSummaryTrendRow, startDate time.Time, endDate time.Time) []DailyCashflowPoint {
	points := make([]DailyCashflowPoint, 0, int(endDate.Sub(startDate).Hours()/24)+1)
	for current := startDate; !current.After(endDate); current = current.AddDate(0, 0, 1) {
		row := rows[current.Format("20060102")]
		points = append(points, DailyCashflowPoint{
			Label:   current.Format("01.02"),
			Expense: float64(row.Expenses),
			Income:  float64(row.Income),
		})
	}

	return points
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
	Type  string
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
			Type:  account.Type,
		}
	}
}

func incomeSourceTitle(meta map[string]accountMeta, accountID string) string {
	account, ok := meta[accountID]
	if !ok || strings.TrimSpace(account.Title) == "" {
		return "미분류"
	}

	return strings.TrimSpace(account.Title)
}

func expenseSourceTitle(meta map[string]accountMeta, accountID string) string {
	account, ok := meta[accountID]
	if !ok || strings.TrimSpace(account.Title) == "" {
		return "미분류"
	}

	return strings.TrimSpace(account.Title)
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

func summaryFromTrendRow(row whooing.ReportSummaryTrendRow) whooing.ReportSummaryResponse {
	return whooing.ReportSummaryResponse{
		Expenses:  float64(row.Expenses),
		Income:    float64(row.Income),
		NetIncome: float64(row.NetIncome),
	}
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
