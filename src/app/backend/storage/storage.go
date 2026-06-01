package storage

import (
	"encoding/json"
	"os"
	"sync"
	"time"
)

type MemoryItem struct {
	Value     string    `json:"value"`
	IsFuzzy   bool      `json:"isFuzzy"`
	CreatedAt time.Time `json:"createdAt"`
}

type MemoryList struct {
	Version  string       `json:"version"`
	Items    []MemoryItem `json:"items"`
	UpdateAt time.Time    `json:"updateAt"`
}

type MemoryStore struct {
	filePath string
	mu       sync.RWMutex
	data     map[string]*MemoryList
}

func NewMemoryStore(filePath string) (*MemoryStore, error) {
	store := &MemoryStore{
		filePath: filePath,
		data:     make(map[string]*MemoryList),
	}

	if err := store.load(); err != nil {
		if os.IsNotExist(err) {
			return store, store.saveNoLock()
		}
		return nil, err
	}

	return store, nil
}

func (s *MemoryStore) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	file, err := os.Open(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return err
	}

	if info.Size() == 0 {
		s.data = make(map[string]*MemoryList)
		return nil
	}

	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&s.data); err != nil {
		s.data = make(map[string]*MemoryList)
		return nil
	}

	return nil
}

func (s *MemoryStore) saveNoLock() error {
	file, err := os.Create(s.filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	return encoder.Encode(s.data)
}

func (s *MemoryStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saveNoLock()
}

func (s *MemoryStore) Get(listName string) (*MemoryList, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, exists := s.data[listName]
	if !exists {
		return nil, nil
	}

	copy := &MemoryList{
		Version:  list.Version,
		Items:    make([]MemoryItem, len(list.Items)),
		UpdateAt: list.UpdateAt,
	}
	copyItems(copy.Items, list.Items)

	return copy, nil
}

func (s *MemoryStore) Set(listName string, list *MemoryList) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	copy := &MemoryList{
		Version:  list.Version,
		Items:    make([]MemoryItem, len(list.Items)),
		UpdateAt: list.UpdateAt,
	}
	copyItems(copy.Items, list.Items)

	s.data[listName] = copy

	return s.saveNoLock()
}

func (s *MemoryStore) Delete(listName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.data, listName)
	return s.saveNoLock()
}

func (s *MemoryStore) GetAll() (map[string]*MemoryList, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make(map[string]*MemoryList)
	for k, v := range s.data {
		copy := &MemoryList{
			Version:  v.Version,
			Items:    make([]MemoryItem, len(v.Items)),
			UpdateAt: v.UpdateAt,
		}
		copyItems(copy.Items, v.Items)
		result[k] = copy
	}

	return result, nil
}

func copyItems(dst, src []MemoryItem) {
	for i, item := range src {
		dst[i] = MemoryItem{
			Value:     item.Value,
			IsFuzzy:   item.IsFuzzy,
			CreatedAt: item.CreatedAt,
		}
	}
}
