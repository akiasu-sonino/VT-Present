import { useState, KeyboardEvent, useEffect } from 'react'
import '../styles/SearchBox.css'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SearchBox({ value, onChange, placeholder = '配信者名や説明で検索...' }: SearchBoxProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [inputValue, setInputValue] = useState(value)

  // 外部からvalueが変更された場合に同期
  useEffect(() => {
    setInputValue(value)
  }, [value])

  const handleClear = () => {
    setInputValue('')
    onChange('')
  }

  const handleSearch = () => {
    onChange(inputValue)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  return (
    <div className={`search-box ${isFocused ? 'focused' : ''}`}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
        />
        {inputValue && (
          <button
            className="clear-button"
            onClick={handleClear}
            type="button"
            aria-label="検索をクリア"
          >
            ✕
          </button>
        )}
        <button
          className="search-button"
          onClick={handleSearch}
          type="button"
          aria-label="検索"
        >
          検索
        </button>
      </div>
    </div>
  )
}

export default SearchBox
