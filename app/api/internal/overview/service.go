package overview

import (
	"context"
	"fmt"
	"slices"
	"time"

	"github.com/hwiyel/whoofolio/app/api/internal/cache"
	"github.com/hwiyel/whoofolio/app/api/internal/whooing"
)

type Snapshot struct {
	Income            float64 `json:"income"`
	Expense           float64 `json:"expense"`
	NetCashflow       float64 `json:"netCashflow"`
	AccountCount      int     `json:"accountCount"`
	PeriodLabel       string  `json:"periodLabel"`
	SectionID         string  `json:"sectionId"`
	SectionTitle      string  `json:"sectionTitle"`
	Currency          string  `json:"currency"`
	TotalAssets       float64 `json:"totalAssets"`
	TotalLiabilities  float64 `json:"totalLiabilities"`
	IsConfigured      bool    `json:"isConfigured"`
}

type TrendRange string

const (
	Range1W TrendRange = "1W"
	Range1M TrendRange = "1M"
	Range3M TrendRange = "3M"
	Range6M TrendRange = "6M"
	Range1Y TrendRange = "1Y"
	Range3Y TrendRange = "3Y"
	Range5Y TrendRange = "5Y"
)

type TrendResponse struct {
	SectionID    string       `json:"sectionId"`
	Range        TrendRange   `json:"range"`
	RowsType     string       `json:"rowsType"`
	CurrentValue float64      `json:"currentValue"`
	ChangeValue  float64      `json:"changeValue"`
	Points       []TrendPoint `json:"points"`
}

type TrendPoint struct {
	Label       string  `json:"label"`
	Assets      float64 `json:"assets"`
	Liabilities float64 `json:"liabilities"`
	Capital     float64 `json:"capital"`
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

func (s Service) Trend(ctx context.Context, now time.Time, requestedRange string) (TrendResponse, error) {
	if !s.whooingClient.HasAPIKey() {
		return TrendResponse{}, nil
	}

	rangeValue := normalizeRange(requestedRange)
	section, err := s.whooingClient.GetDefaultSection(ctx)
	if err != nil {
		return TrendResponse{}, err
	}

	cacheKey := fmt.Sprintf("overview-trend:%s:%s:%s", section.SectionID, rangeValue, now.Format("20060102"))
	if cached, ok := s.cache.Get(cacheKey); ok {
		if response, ok := cached.(TrendResponse); ok {
			return response, nil
		}
	}

	startDate, rowsType := rangeWindow(now, rangeValue)
	trend, err := s.whooingClient.GetBalanceTrend(
		ctx,
		section.SectionID,
		rowsType,
		startDate,
		now.Format("20060102"),
	)
	if err != nil {
		return TrendResponse{}, err
	}

	keys := make([]string, 0, len(trend.Rows))
	for key := range trend.Rows {
		keys = append(keys, key)
	}
	slices.Sort(keys)

	points := make([]TrendPoint, 0, len(keys))
	for _, key := range keys {
		row := trend.Rows[key]
		points = append(points, TrendPoint{
			Label:       formatTrendLabel(string(row.Date), rowsType),
			Assets:      float64(row.Assets),
			Liabilities: float64(row.Liabilities),
			Capital:     float64(row.Capital),
		})
	}

	currentValue := float64(trend.Aggregate.Capital)
	changeValue := 0.0
	if len(points) > 0 {
		changeValue = currentValue - points[0].Capital
	}

	response := TrendResponse{
		SectionID:    section.SectionID,
		Range:        rangeValue,
		RowsType:     rowsType,
		CurrentValue: currentValue,
		ChangeValue:  changeValue,
		Points:       points,
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func (s Service) Snapshot(ctx context.Context, now time.Time) (Snapshot, error) {
	if !s.whooingClient.HasAPIKey() {
		return Snapshot{
			PeriodLabel:  "이번 달",
			IsConfigured: false,
		}, nil
	}

	section, err := s.whooingClient.GetDefaultSection(ctx)
	if err != nil {
		return Snapshot{}, err
	}

	cacheKey := fmt.Sprintf("overview-snapshot:%s:%s", section.SectionID, now.Format("20060102"))
	if cached, ok := s.cache.Get(cacheKey); ok {
		if response, ok := cached.(Snapshot); ok {
			return response, nil
		}
	}

	accounts, err := s.whooingClient.GetAccounts(ctx, section.SectionID)
	if err != nil {
		return Snapshot{}, err
	}

	summary, err := s.whooingClient.GetMonthlySummary(
		ctx,
		section.SectionID,
		now.Format("200601")+"01",
		now.Format("20060102"),
	)
	if err != nil {
		return Snapshot{}, err
	}

	response := Snapshot{
		Income:           summary.Income,
		Expense:          summary.Expenses,
		NetCashflow:      summary.NetIncome,
		AccountCount:     countAccounts(accounts),
		PeriodLabel:      "이번 달",
		SectionID:        section.SectionID,
		SectionTitle:     section.Title,
		Currency:         section.Currency,
		TotalAssets:      section.TotalAssets,
		TotalLiabilities: section.TotalLiabilities,
		IsConfigured:     true,
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func countAccounts(accounts whooing.AccountsResponse) int {
	return countLeaf(accounts.Assets) +
		countLeaf(accounts.Liabilities) +
		countLeaf(accounts.Capital) +
		countLeaf(accounts.Expenses) +
		countLeaf(accounts.Income)
}

func countLeaf(accounts []whooing.Account) int {
	count := 0
	for _, account := range accounts {
		if account.Type != "group" {
			count++
		}
	}

	return count
}

func normalizeRange(value string) TrendRange {
	switch TrendRange(value) {
	case Range1W, Range1M, Range3M, Range6M, Range1Y, Range3Y, Range5Y:
		return TrendRange(value)
	default:
		return Range1Y
	}
}

func rangeWindow(now time.Time, rangeValue TrendRange) (string, string) {
	switch rangeValue {
	case Range1W:
		return now.AddDate(0, 0, -6).Format("20060102"), "day"
	case Range1M:
		return now.AddDate(0, -1, 0).Format("20060102"), "day"
	case Range3M:
		return now.AddDate(0, -3, 0).Format("20060102"), "day"
	case Range6M:
		return now.AddDate(0, -6, 0).Format("20060102"), "day"
	case Range3Y:
		return now.AddDate(-3, 0, 0).Format("20060102"), "month"
	case Range5Y:
		return now.AddDate(-5, 0, 0).Format("20060102"), "month"
	default:
		return now.AddDate(-1, 0, 0).Format("20060102"), "month"
	}
}

func formatTrendLabel(raw string, rowsType string) string {
	switch rowsType {
	case "day":
		if len(raw) == 8 {
			return raw[4:6] + "." + raw[6:8]
		}
	case "month":
		if len(raw) == 6 {
			return raw[2:4] + "." + raw[4:6]
		}
	}

	return raw
}
