package main

import (
	"log"
	"net/http"

	"github.com/hwiyel/whoofolio/app/api/internal/config"
	apihttp "github.com/hwiyel/whoofolio/app/api/internal/http"
)

func main() {
	cfg := config.Load()
	server := apihttp.NewServer(cfg)

	log.Printf("whoofolio api listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, server.Router()); err != nil {
		log.Fatal(err)
	}
}

