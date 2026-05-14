package whooing

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
}

func NewClient(baseURL string, apiKey string) Client {
	return Client{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		http: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

func (c Client) HasAPIKey() bool {
	return strings.TrimSpace(c.apiKey) != ""
}

func (c Client) GetDefaultSection(ctx context.Context) (Section, error) {
	return fetch[Section](ctx, c, "/sections/default.json", nil)
}

func (c Client) GetAccounts(ctx context.Context, sectionID string) (AccountsResponse, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)

	return fetch[AccountsResponse](ctx, c, "/accounts.json", query)
}

func (c Client) GetMonthlySummary(ctx context.Context, sectionID string, startDate string, endDate string) (ReportSummaryResponse, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)
	query.Set("account", "expenses,income")
	query.Set("rows_type", "none")
	query.Set("start_date", startDate)
	query.Set("end_date", endDate)

	return fetch[ReportSummaryResponse](ctx, c, "/report_summary.json", query)
}

func (c Client) GetBalanceTrend(ctx context.Context, sectionID string, rowsType string, startDate string, endDate string) (BalanceTrendResponse, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)
	query.Set("account", "assets,liabilities")
	query.Set("rows_type", rowsType)
	query.Set("start_date", startDate)
	query.Set("end_date", endDate)

	return fetch[BalanceTrendResponse](ctx, c, "/report_summary.json", query)
}

func (c Client) GetEntries(ctx context.Context, params url.Values) (EntriesResponse, error) {
	return fetch[EntriesResponse](ctx, c, "/entries.json", params)
}

func (c Client) GetAccountIDsOfAccount(
	ctx context.Context,
	sectionID string,
	account string,
	startDate string,
	endDate string,
) ([]NameMoneyRow, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)
	query.Set("account", account)
	query.Set("start_date", startDate)
	query.Set("end_date", endDate)

	return fetch[[]NameMoneyRow](ctx, c, "/entries/account_ids_of_account.json", query)
}

func (c Client) GetItemsOfAccountID(
	ctx context.Context,
	sectionID string,
	account string,
	accountID string,
	startDate string,
	endDate string,
) ([]NameMoneyRow, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)
	query.Set("account", account)
	query.Set("account_id", accountID)
	query.Set("start_date", startDate)
	query.Set("end_date", endDate)

	return fetch[[]NameMoneyRow](ctx, c, "/entries/items_of_account_id.json", query)
}

func (c Client) GetChangesOfAccountID(
	ctx context.Context,
	sectionID string,
	account string,
	accountID string,
	startDate string,
	endDate string,
) (AccountDailyChangesResponse, error) {
	query := url.Values{}
	query.Set("section_id", sectionID)
	query.Set("account", account)
	query.Set("account_id", accountID)
	query.Set("start_date", startDate)
	query.Set("end_date", endDate)

	return fetch[AccountDailyChangesResponse](ctx, c, "/entries/changes_of_account_id.json", query)
}

func fetch[T any](ctx context.Context, client Client, path string, query url.Values) (T, error) {
	var zero T

	if !client.HasAPIKey() {
		return zero, fmt.Errorf("whooing api key is not configured")
	}

	requestURL := client.baseURL + path
	if len(query) > 0 {
		requestURL += "?" + query.Encode()
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, requestURL, nil)
	if err != nil {
		return zero, err
	}

	req.Header.Set("X-API-KEY", client.apiKey)
	req.Header.Set("Accept", "application/json")

	resp, err := client.http.Do(req)
	if err != nil {
		return zero, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		return zero, fmt.Errorf("whooing api returned status %d", resp.StatusCode)
	}

	var decoded envelope[T]
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return zero, err
	}

	if decoded.Code >= http.StatusBadRequest {
		return zero, fmt.Errorf("whooing api error: %s", decoded.Message)
	}

	return decoded.Results, nil
}
