import { useState } from 'react'
import '../styles/SearchBox.css'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

function SearchBox({ value, onChange, placeholder = '配信者名や説明で検索...' }: SearchBoxProps) {
  const [isFocused, setIsFocused] = useState(false)

  const handleClear = () => {
    onChange('')
  }

  return (
    <div className={`search-box ${isFocused ? 'focused' : ''}`}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔍</span>
        <input
          type="text"
          className="search-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
        />
        {value && (
          <button
            className="clear-button"
            onClick={handleClear}
            type="button"
            aria-label="検索をクリア"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

export default SearchBox
