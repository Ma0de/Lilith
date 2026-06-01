package agent

import (
	"fmt"
	"time"
)

const (
	FuzzyThreshold = 16
	ConfuseWindow  = 60
	ConfuseCount   = 5
	ResetKeepCount = 3
)

type MemoryItem struct {
	Value   string
	IsFuzzy bool
}

type MemoryList struct {
	Version    string
	Items      []MemoryItem
	UpdateTime time.Time
}

type MemoryDelta struct {
	ListName string
	Version  string
	Items    []string
}

type ModifyRecord struct {
	ListName  string
	Timestamp time.Time
}

type MemoryManager struct {
	store         MemoryStorage
	modifyHistory []ModifyRecord
}

type MemoryStorage interface {
	Get(listName string) (*MemoryList, error)
	Set(listName string, list *MemoryList) error
}

func NewMemoryManager(store MemoryStorage) *MemoryManager {
	return &MemoryManager{
		store:         store,
		modifyHistory: make([]ModifyRecord, 0),
	}
}

func (m *MemoryManager) GetList(listName string) (*MemoryList, error) {
	return m.store.Get(listName)
}

func (m *MemoryManager) AddItem(listName string, item string, currentVersion string) (*MemoryList, error) {
	list, err := m.store.Get(listName)
	if err != nil {
		return nil, err
	}

	if list == nil {
		list = &MemoryList{
			Version:    "00001",
			Items:      []MemoryItem{},
			UpdateTime: time.Now(),
		}
	}

	if err := m.checkVersion(list, currentVersion); err != nil {
		return nil, err
	}

	list.Items = append(list.Items, MemoryItem{Value: item, IsFuzzy: false})
	list.Version = m.nextVersion(list.Version)
	list.UpdateTime = time.Now()

	m.recordModify(listName)

	if err := m.store.Set(listName, list); err != nil {
		return nil, err
	}

	return list, nil
}

func (m *MemoryManager) ReplaceItem(listName string, oldItem string, newItem string, currentVersion string) (*MemoryList, error) {
	list, err := m.store.Get(listName)
	if err != nil {
		return nil, err
	}

	if list == nil {
		return nil, fmt.Errorf("list not found")
	}

	if err := m.checkVersion(list, currentVersion); err != nil {
		return nil, err
	}

	newItems := make([]MemoryItem, 0, len(list.Items)+1)
	found := false

	for _, item := range list.Items {
		if !item.IsFuzzy && item.Value == oldItem {
			newItems = append(newItems, MemoryItem{Value: oldItem, IsFuzzy: true})
			newItems = append(newItems, MemoryItem{Value: newItem, IsFuzzy: false})
			found = true
		} else {
			newItems = append(newItems, item)
		}
	}

	if !found {
		newItems = append(newItems, MemoryItem{Value: newItem, IsFuzzy: false})
	}

	list.Items = newItems
	list.Version = m.nextVersion(list.Version)
	list.UpdateTime = time.Now()

	m.recordModify(listName)

	if err := m.store.Set(listName, list); err != nil {
		return nil, err
	}

	m.cleanupFuzzyItems(listName, list)

	return list, nil
}

func (m *MemoryManager) DeleteItem(listName string, item string, currentVersion string) (*MemoryList, error) {
	list, err := m.store.Get(listName)
	if err != nil {
		return nil, err
	}

	if list == nil {
		return nil, fmt.Errorf("list not found")
	}

	if err := m.checkVersion(list, currentVersion); err != nil {
		return nil, err
	}

	for i, it := range list.Items {
		if !it.IsFuzzy && it.Value == item {
			list.Items[i].IsFuzzy = true
			break
		}
	}

	list.Version = m.nextVersion(list.Version)
	list.UpdateTime = time.Now()

	m.recordModify(listName)

	if err := m.store.Set(listName, list); err != nil {
		return nil, err
	}

	m.cleanupFuzzyItems(listName, list)

	return list, nil
}

func (m *MemoryManager) ResetList(listName string, keepCount int, currentVersion string) (*MemoryList, error) {
	list, err := m.store.Get(listName)
	if err != nil {
		return nil, err
	}

	if list == nil {
		return nil, fmt.Errorf("list not found")
	}

	if err := m.checkVersion(list, currentVersion); err != nil {
		return nil, err
	}

	clearItems := make([]MemoryItem, 0)
	for _, item := range list.Items {
		if !item.IsFuzzy {
			clearItems = append(clearItems, item)
		}
	}

	if keepCount > 0 && len(clearItems) > keepCount {
		clearItems = clearItems[len(clearItems)-keepCount:]
	}

	list.Items = clearItems
	list.Version = m.nextVersion(list.Version)
	list.UpdateTime = time.Now()

	if err := m.store.Set(listName, list); err != nil {
		return nil, err
	}

	return list, nil
}

func (m *MemoryManager) ShouldConfuse(listName string) bool {
	now := time.Now()
	count := 0

	for i := len(m.modifyHistory) - 1; i >= 0; i-- {
		record := m.modifyHistory[i]
		if record.ListName != listName {
			continue
		}
		if now.Sub(record.Timestamp) > time.Duration(ConfuseWindow)*time.Second {
			break
		}
		count++
	}

	return count >= ConfuseCount
}

func (m *MemoryManager) GetMemoryDelta(listName string) (*MemoryDelta, error) {
	list, err := m.store.Get(listName)
	if err != nil {
		return nil, err
	}

	if list == nil {
		return nil, nil
	}

	items := make([]string, len(list.Items))
	for i, item := range list.Items {
		if item.IsFuzzy {
			items[i] = "#" + item.Value
		} else {
			items[i] = item.Value
		}
	}

	return &MemoryDelta{
		ListName: listName,
		Version:  list.Version,
		Items:    items,
	}, nil
}

func (m *MemoryManager) checkVersion(list *MemoryList, clientVersion string) error {
	if list != nil && clientVersion != "" && list.Version != clientVersion {
		return fmt.Errorf("version mismatch: server=%s, client=%s", list.Version, clientVersion)
	}
	return nil
}

func (m *MemoryManager) nextVersion(current string) string {
	var num int
	fmt.Sscanf(current, "%05d", &num)
	num++
	return fmt.Sprintf("%05d", num)
}

func (m *MemoryManager) recordModify(listName string) {
	m.modifyHistory = append(m.modifyHistory, ModifyRecord{
		ListName:  listName,
		Timestamp: time.Now(),
	})

	for i := 0; i < len(m.modifyHistory)-100; i++ {
		m.modifyHistory = m.modifyHistory[1:]
	}
}

func (m *MemoryManager) cleanupFuzzyItems(listName string, list *MemoryList) {
	fuzzyCount := 0
	for _, item := range list.Items {
		if item.IsFuzzy {
			fuzzyCount++
		}
	}

	if fuzzyCount > FuzzyThreshold {
		newItems := make([]MemoryItem, 0)
		keptFuzzy := 0
		for _, item := range list.Items {
			if !item.IsFuzzy {
				newItems = append(newItems, item)
			} else if keptFuzzy < FuzzyThreshold/2 {
				newItems = append(newItems, item)
				keptFuzzy++
			}
		}
		list.Items = newItems
		list.Version = m.nextVersion(list.Version)
		list.UpdateTime = time.Now()
		m.store.Set(listName, list)
	}
}
