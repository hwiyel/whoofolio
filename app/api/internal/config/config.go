package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"sync"
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

var loadEnvOnce sync.Once

func Load() Config {
	loadEnvOnce.Do(loadDotEnvIfPresent)

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

func loadDotEnvIfPresent() {
	paths := []string{
		".env",
		filepath.Join("..", ".env"),
		filepath.Join("..", "..", ".env"),
	}

	for _, path := range paths {
		loadEnvFile(path)
	}
}

func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}

		key = strings.TrimSpace(key)
		value = strings.TrimSpace(value)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}

		_ = os.Setenv(key, value)
	}
}
