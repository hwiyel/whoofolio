package http

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hwiyel/whoofolio/app/api/internal/accounts"
	"github.com/hwiyel/whoofolio/app/api/internal/config"
	"github.com/hwiyel/whoofolio/app/api/internal/overview"
	"github.com/hwiyel/whoofolio/app/api/internal/reports"
	"github.com/hwiyel/whoofolio/app/api/internal/transactions"
	"github.com/hwiyel/whoofolio/app/api/internal/whooing"
)

type Server struct {
	accountsService     accounts.Service
	config              config.Config
	overviewService     overview.Service
	reportsService      reports.Service
	transactionsService transactions.Service
}

func NewServer(cfg config.Config) Server {
	whooingClient := whooing.NewClient(cfg.WhooingAPIURL, cfg.WhooingAPIKey)

	return Server{
		accountsService:     accounts.NewService(whooingClient),
		config:              cfg,
		overviewService:     overview.NewService(whooingClient),
		reportsService:      reports.NewService(whooingClient),
		transactionsService: transactions.NewService(whooingClient),
	}
}

func (s Server) Router() http.Handler {
	router := chi.NewRouter()
	router.Get("/api/health", s.handleHealth)
	router.Get("/api/accounts", s.handleAccounts)
	router.Get("/api/overview", s.handleOverview)
	router.Get("/api/overview/trend", s.handleOverviewTrend)
	router.Get("/api/reports/monthly", s.handleMonthlyReport)
	router.Get("/api/transactions", s.handleTransactions)

	publicDir := filepath.Join(".", "public")
	if _, err := os.Stat(publicDir); err == nil {
		router.Handle("/*", http.FileServer(http.Dir(publicDir)))
	}

	return router
}

func (s Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (s Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	snapshot, err := s.overviewService.Snapshot(r.Context(), time.Now())
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, snapshot)
}

func (s Server) handleOverviewTrend(w http.ResponseWriter, r *http.Request) {
	response, err := s.overviewService.Trend(r.Context(), time.Now(), r.URL.Query().Get("range"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s Server) handleAccounts(w http.ResponseWriter, r *http.Request) {
	response, err := s.accountsService.List(r.Context(), r.URL.Query().Get("sectionId"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s Server) handleMonthlyReport(w http.ResponseWriter, r *http.Request) {
	response, err := s.reportsService.Monthly(r.Context(), time.Now(), r.URL.Query().Get("month"))
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func (s Server) handleTransactions(w http.ResponseWriter, r *http.Request) {
	query := transactions.Query{
		SectionID: r.URL.Query().Get("sectionId"),
		StartDate: r.URL.Query().Get("startDate"),
		EndDate:   r.URL.Query().Get("endDate"),
		Max:       r.URL.Query().Get("max"),
		Account:   r.URL.Query().Get("account"),
		AccountID: r.URL.Query().Get("accountId"),
		Keyword:   r.URL.Query().Get("keyword"),
		Item:      r.URL.Query().Get("item"),
		Memo:      r.URL.Query().Get("memo"),
	}

	if limitValue := r.URL.Query().Get("limit"); limitValue != "" {
		if parsedLimit, err := strconv.Atoi(limitValue); err == nil {
			query.Limit = parsedLimit
		}
	}

	response, err := s.transactionsService.List(r.Context(), time.Now(), query)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, response)
}

func writeJSON(w http.ResponseWriter, statusCode int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
