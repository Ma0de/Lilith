package errors  
  
import "errors"  
  
var (  
    ErrVersionMismatch = errors.New("version mismatch")  
    ErrListNotFound = errors.New("memory list not found")  
    ErrTTSFailed = errors.New("tts synthesis failed")  
    ErrLLMFailed = errors.New("llm request failed")  
) 
