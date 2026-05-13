package cache

import (
	"sync"
	"time"
)

type entry struct {
	expiresAt time.Time
	value     any
}

type Memory struct {
	mu    sync.RWMutex
	items map[string]entry
	ttl   time.Duration
}

func NewMemory(ttl time.Duration) *Memory {
	return &Memory{
		items: map[string]entry{},
		ttl:   ttl,
	}
}

func (c *Memory) Get(key string) (any, bool) {
	c.mu.RLock()
	item, ok := c.items[key]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}

	if time.Now().After(item.expiresAt) {
		c.mu.Lock()
		delete(c.items, key)
		c.mu.Unlock()
		return nil, false
	}

	return item.value, true
}

func (c *Memory) Set(key string, value any) {
	c.mu.Lock()
	c.items[key] = entry{
		expiresAt: time.Now().Add(c.ttl),
		value:     value,
	}
	c.mu.Unlock()
}
