package config  
  
import (  
    "os"  
    "time"  
)  
  
type Config struct {  
    LLM LLMConfig  
    TTS TTSConfig  
    Server ServerConfig  
    Storage StorageConfig  
}  
  
type LLMConfig struct {  
    BaseURL string  
    APIKey string  
    ModelName string  
}  
  
type TTSConfig struct {  
    BaseURL string  
    Timeout time.Duration  
}  
  
type ServerConfig struct {  
    Port string  
}  
  
type StorageConfig struct {  
    MemoryFilePath string  
}  
  
func Load() *Config {  
    return &Config{  
        LLM: LLMConfig{  
            BaseURL: os.Getenv("LLM_BASE_URL"),  
            APIKey: os.Getenv("LLM_API_KEY"),  
            ModelName: os.Getenv("LLM_MODEL_NAME"),  
        },  
        TTS: TTSConfig{  
            BaseURL: os.Getenv("TTS_BASE_URL"),  
            Timeout: 90 * time.Second,  
        },  
        Server: ServerConfig{  
            Port: getEnv("SERVER_PORT", "8080"),  
        },  
        Storage: StorageConfig{  
            MemoryFilePath: getEnv("MEMORY_FILE", "./lilith_memory.json"),  
        },  
    }  
}  
  
func getEnv(key, defaultValue string) string {  
    if value := os.Getenv(key); value != "" {  
        return value  
    }  
    return defaultValue  
} 
