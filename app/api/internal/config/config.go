package config

import (
	"os"
)

type Config struct {
	AppBaseURL    string
	DatabaseURL   string
	Port          string
	SessionSecret string
	SyncSchedule  string
	WhooingAPIKey string
	WhooingAPIURL string
}

func Load() Config {
	return Config{
		AppBaseURL:    envOrDefault("APP_BASE_URL", "http://localhost"),
		DatabaseURL:   envOrDefault("DATABASE_URL", "postgres://whoofolio:whoofolio@localhost:5432/whoofolio?sslmode=disable"),
		Port:          envOrDefault("PORT", "8080"),
		SessionSecret: envOrDefault("SESSION_SECRET", "change-me"),
		SyncSchedule:  envOrDefault("SYNC_SCHEDULE", "*/10 * * * *"),
		WhooingAPIKey: envOrDefault("WHOOING_API_KEY", ""),
		WhooingAPIURL: envOrDefault("WHOOING_API_URL", "https://whooing.com/api"),
	}
}

func envOrDefault(key string, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}
