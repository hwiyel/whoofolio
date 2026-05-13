package accounts

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/hwiyel/whoofolio/app/api/internal/cache"
	"github.com/hwiyel/whoofolio/app/api/internal/whooing"
)

type Account struct {
	AccountID string `json:"accountId"`
	Title     string `json:"title"`
	Type      string `json:"type"`
	Group     string `json:"group"`
	CloseDate string `json:"closeDate"`
}

type Response struct {
	SectionID string    `json:"sectionId"`
	Rows      []Account `json:"rows"`
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

func (s Service) List(ctx context.Context, sectionID string) (Response, error) {
	if !s.whooingClient.HasAPIKey() {
		return Response{}, nil
	}

	if strings.TrimSpace(sectionID) == "" {
		section, err := s.whooingClient.GetDefaultSection(ctx)
		if err != nil {
			return Response{}, err
		}
		sectionID = section.SectionID
	}

	cacheKey := fmt.Sprintf("accounts:%s", sectionID)
	if cached, ok := s.cache.Get(cacheKey); ok {
		if response, ok := cached.(Response); ok {
			return response, nil
		}
	}

	accounts, err := s.whooingClient.GetAccounts(ctx, sectionID)
	if err != nil {
		return Response{}, err
	}

	rows := make([]Account, 0)
	rows = append(rows, flattenAccounts("assets", accounts.Assets)...)
	rows = append(rows, flattenAccounts("liabilities", accounts.Liabilities)...)
	rows = append(rows, flattenAccounts("capital", accounts.Capital)...)
	rows = append(rows, flattenAccounts("expenses", accounts.Expenses)...)
	rows = append(rows, flattenAccounts("income", accounts.Income)...)

	response := Response{
		SectionID: sectionID,
		Rows:      rows,
	}
	s.cache.Set(cacheKey, response)

	return response, nil
}

func flattenAccounts(group string, accounts []whooing.Account) []Account {
	rows := make([]Account, 0, len(accounts))
	for _, account := range accounts {
		if account.Type == "group" {
			continue
		}

		rows = append(rows, Account{
			AccountID: account.AccountID,
			Title:     account.Title,
			Type:      account.Type,
			Group:     group,
			CloseDate: string(account.CloseDate),
		})
	}

	return rows
}
