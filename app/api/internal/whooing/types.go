package whooing

import (
	"encoding/json"
	"strconv"
	"strings"
)

type envelope[T any] struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Results T      `json:"results"`
}

type Section struct {
	SectionID        string  `json:"section_id"`
	Title            string  `json:"title"`
	Currency         string  `json:"currency"`
	TotalAssets      float64 `json:"total_assets"`
	TotalLiabilities float64 `json:"total_liabilities"`
}

type AccountsResponse struct {
	Assets      []Account `json:"assets"`
	Liabilities []Account `json:"liabilities"`
	Capital     []Account `json:"capital"`
	Expenses    []Account `json:"expenses"`
	Income      []Account `json:"income"`
}

type Account struct {
	AccountID string         `json:"account_id"`
	Type      string         `json:"type"`
	Title     string         `json:"title"`
	CloseDate FlexibleString `json:"close_date"`
}

type ReportSummaryResponse struct {
	Expenses  float64 `json:"expenses"`
	Income    float64 `json:"income"`
	NetIncome float64 `json:"net_income"`
}

type ReportSummaryTrendResponse struct {
	RowsType  string                           `json:"rows_type"`
	Rows      map[string]ReportSummaryTrendRow `json:"rows"`
	Aggregate ReportSummaryAggregate           `json:"aggregate"`
}

type ReportSummaryTrendRow struct {
	Date      FlexibleString `json:"date"`
	Expenses  FlexibleNumber `json:"expenses"`
	Income    FlexibleNumber `json:"income"`
	NetIncome FlexibleNumber `json:"net_income"`
}

type ReportSummaryAggregate struct {
	Expenses  FlexibleNumber `json:"expenses"`
	Income    FlexibleNumber `json:"income"`
	NetIncome FlexibleNumber `json:"net_income"`
}

type ReportAccountResponse struct {
	RowsType  string                      `json:"rows_type"`
	Rows      map[string]ReportAccountRow `json:"rows"`
	Aggregate ReportAccountAggregate      `json:"aggregate"`
}

type ReportAccountRow struct {
	Date    FlexibleString      `json:"date"`
	Income  *ReportAccountGroup `json:"income,omitempty"`
	Expense *ReportAccountGroup `json:"expenses,omitempty"`
}

type ReportAccountAggregate struct {
	Income  *ReportAccountGroup `json:"income,omitempty"`
	Expense *ReportAccountGroup `json:"expenses,omitempty"`
}

type ReportAccountGroup struct {
	Total    FlexibleNumber            `json:"total"`
	Accounts map[string]FlexibleNumber `json:"accounts"`
}

type NameMoneyRow struct {
	Name  string         `json:"name"`
	Money FlexibleNumber `json:"money"`
}

type BalanceTrendResponse struct {
	RowsType  string                     `json:"rows_type"`
	Rows      map[string]BalanceTrendRow `json:"rows"`
	Aggregate BalanceTrendAggregate      `json:"aggregate"`
}

type BalanceTrendRow struct {
	Assets      FlexibleNumber `json:"assets"`
	Liabilities FlexibleNumber `json:"liabilities"`
	Capital     FlexibleNumber `json:"capital"`
	Date        FlexibleString `json:"date"`
}

type BalanceTrendAggregate struct {
	Assets      FlexibleNumber `json:"assets"`
	Liabilities FlexibleNumber `json:"liabilities"`
	Capital     FlexibleNumber `json:"capital"`
}

type AccountDailyChangesResponse struct {
	RowsType  string                   `json:"rows_type"`
	Rows      []AccountDailyChangeRow  `json:"rows"`
	Aggregate AccountDailyChangeTotals `json:"aggregate"`
}

type AccountDailyChangeRow struct {
	Date  FlexibleString `json:"date"`
	Money FlexibleNumber `json:"money"`
}

type AccountDailyChangeTotals struct {
	In  FlexibleNumber `json:"in"`
	Out FlexibleNumber `json:"out"`
}

type EntriesResponse struct {
	Rows []Entry `json:"rows"`
}

func (v *EntriesResponse) UnmarshalJSON(data []byte) error {
	type alias EntriesResponse

	var objectValue alias
	if err := json.Unmarshal(data, &objectValue); err == nil {
		*v = EntriesResponse(objectValue)
		if v.Rows == nil {
			v.Rows = []Entry{}
		}
		return nil
	}

	var arrayValue []Entry
	if err := json.Unmarshal(data, &arrayValue); err == nil {
		v.Rows = arrayValue
		return nil
	}

	return nil
}

type Entry struct {
	EntryID     int64          `json:"entry_id"`
	EntryDate   FlexibleString `json:"entry_date"`
	LAccount    string         `json:"l_account"`
	LAccountID  string         `json:"l_account_id"`
	RAccount    string         `json:"r_account"`
	RAccountID  string         `json:"r_account_id"`
	Item        string         `json:"item"`
	Money       FlexibleNumber `json:"money"`
	Total       FlexibleNumber `json:"total"`
	Memo        string         `json:"memo"`
	AppID       int64          `json:"app_id"`
	Attachments []Attachment   `json:"attachments"`
}

type Attachment struct {
	UUID     string `json:"uuid"`
	Src      string `json:"src"`
	Filename string `json:"filename"`
	MimeType string `json:"mimeType"`
	Size     int64  `json:"size"`
}

type FlexibleString string

func (v *FlexibleString) UnmarshalJSON(data []byte) error {
	var stringValue string
	if err := json.Unmarshal(data, &stringValue); err == nil {
		*v = FlexibleString(stringValue)
		return nil
	}

	var numberValue json.Number
	if err := json.Unmarshal(data, &numberValue); err == nil {
		*v = FlexibleString(numberValue.String())
		return nil
	}

	return nil
}

type FlexibleNumber float64

func (v *FlexibleNumber) UnmarshalJSON(data []byte) error {
	var numberValue float64
	if err := json.Unmarshal(data, &numberValue); err == nil {
		*v = FlexibleNumber(numberValue)
		return nil
	}

	var stringValue string
	if err := json.Unmarshal(data, &stringValue); err == nil {
		parsed, parseErr := strconv.ParseFloat(strings.TrimSpace(stringValue), 64)
		if parseErr != nil {
			return parseErr
		}
		*v = FlexibleNumber(parsed)
		return nil
	}

	return nil
}
