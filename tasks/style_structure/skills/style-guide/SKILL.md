# Style Guide Skill

## Purpose
Enforce consistent code style and naming conventions.

## Naming Conventions
- **Variables/Functions**: camelCase (`getUserName`, `totalCount`)
- **Classes/Components**: PascalCase (`UserProfile`, `DataManager`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_BASE_URL`)
- **Files**: kebab-case (`user-profile.js`, `data-manager.ts`)
- **Private members**: prefix with underscore (`_internalState`)

## Code Structure
- Maximum function length: 30 lines
- Maximum file length: 300 lines
- One class/component per file
- Group imports: external → internal → relative

## Formatting
- 2 spaces for indentation
- Single quotes for strings
- Semicolons required
- Trailing commas in multiline
- Max line length: 100 characters

## Patterns
- Prefer `const` over `let`, never use `var`
- Use template literals over string concatenation
- Use arrow functions for callbacks
- Use destructuring where appropriate
- Use optional chaining (?.) and nullish coalescing (??)
