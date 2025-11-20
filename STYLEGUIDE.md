# CODE STYLEGUIDE

This is not intended to be prescriptive. Rather, it may be useful when unsure how to go about ordering, structuring, or naming code.  
This was written with TypeScript in mind but can easily be extended to other languages.

----------------

# I. Naming conventions

### 1. Variable name conventions:

| Type                       | Convention                        |
| -------------------------- | --------------------------------- |
| Variables                  | camelCase (aka headlessCamelCase) |
| Constants, enum members    | UPPER_SNAKE_CASE                  |
| Classes, enums, interfaces | PascalCase                        |
| Functions                  | camelCase                         |

### 2. Variable naming:
   2.1. Variables should be explicitly typed, except when the type is trivial (e.g. `x = 0`).  
&nbsp;&nbsp;&nbsp;&nbsp;(i) This includes variables from functions (e.g. `x = getCount()` is wrong, `x: number = getCount()` is correct).  
   2.2. Prepend an underscore to variables that are intentionally unused, and to functions that must be overridden.  
   2.3. Iterators may use `i, j, k`... or `n`.  
   2.4. Avoid abbreviating variable names unless necessary, or if the abbreviation is commonly preferred.  
   2.5. Variable names should not include the type unless needed to distinguish properties between classes.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Example:
   	  
	    class Item3D {
	            name: string;
	            globalPosition3D: Vector3D;
	            position3D: Vector3D;
	    }
    
   2.6. Avoid using pronumerals if a descriptive name would improve clarity.  
   2.7. Boolean variables should be prefixed with predicate verbs ("is" "has" "can" etc.) (e.g. `isActive`, `hasPermission`).  
   2.8. Function names should be descriptive and contain an action (e.g. `allowEntry()`, `getNewFile()`).

### 3. File and directory naming:  
   3.1. File and directory names should use kebab-case.  
   3.2. Files that primarily contain a named class should have the same filename as the class name, converted to kebab-case.  

----------------

# III. Code formatting

### 1. Indentation:  
   1.1. Use four spaces or one tab to indent. Do not mix spaces and tabs in the same project.  
   1.2. Use two levels of indentation to distinguish continuation lines from regular code blocks, except when declaring dictionaries, arrays, and enums. Use only one level for these.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Example:  
   
   	if (position.x >= position.y &&
   		position.z >= position.y &&
   		this.isActive && !this.isDead) {
   		...

### 2. Commas and trailing syntax:  
   2.1. Always use a trailing comma for multi-line lists and declarations (e.g. `[a,b,c,d]` should not have a trailing comma).          
   2.2. Use semicolons consistently; either use no semicolons or always use semicolons.  
   2.3. Place opening braces on the same line as their statement (K&R style).
    
### 3. Whitespace:  
   3.1. Surround level-1 functions and class definitions with two blank lines.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Class methods in the same section should be separated with only one blank line.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) Use blank lines to indicate grouping by domain/usage/logical sections in functions.  
   3.2. Use one space after colons, and around binary operators:  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Place spaces after commas, except for inline declarations.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) Examples:  
       
		["apples","bananas","oranges"] // No spaces
		(param, anotherparam, athirdparam)
		variableName: TypeOfVariable
		a + b && x + y

3.3. Unary operators should not have a space (e.g. `! isActive`, `- value` is wrong; `!isActive`, `-value` is correct).  
3.4. Ternary operators should have a space on both sides (e.g. `isActive ? 'active' : 'inactive'` is correct).  
    3.5. Increment/decrement operators (`++/--`) should not have a space (e.g. `i++`).  
    3.6. Do not use a space after function calls (e.g. `main (x: number, y: number)` is wrong).  
    3.7. Do not place a space on the inside of parentheses (e.g. `( x + y )` is wrong, `(x + y)` is correct).  
    
### 4. Floating-point numbers:
4.1. Do not omit the leading or trailing zero (e.g. `.554, 2.` is wrong, `0.554, 2.0` is correct.).  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Always declare floats with at least one trailing zero. However, you do not need to include more than one unless the case below applies.  
4.2. When floating-point numbers are declared in groups, use consistent precision (e.g. `[1.12, 1.45, 1.50, 1.12]`).  

### 5. Strings:
   5.1. Strings may use single quotes, double quotes, or backticks,[^*] but avoid mixing both in the same file.

### 6. Hexadecimal values and other non-case-sensitive encoding:
6.1. Letters in hexadecimal and other values may be uppercase or lowercase,[^*] but should be consistent across the project.  
6.2. Prefer uppercase where it is useful to distinguish values from regular text.  

### 7. Operators:
   7.1. In languages with both keyword and symbolic operators (e.g. both `not` and `!` may be used), prefer the keyword operator except in cases where the operator is acting as a unary operator (e.g. `if (!raining and sunny)`).  
   7.2. Avoid using parentheses unnecessarily.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) This does not preclude the use of parentheses for removing ambiguity.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) It could also be considered whether it is possible to reorder mathematical equations so that they are evaluated from left to right (e.g. `a / b * c` can be written as `c * a / b` or `(a / b) * c`).  

### 8. Comments:  
8.1. Documentation comments should start with a space.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Comments should be placed before or inline with the relevant code.  
8.2. Code that is commented out should not include a leading space.  
8.3. Example:  
  
		// This is a comment.
		# This is a comment as well.
		/* This is a
		multi-line comment. */
		//function renderNewCanvas() // This is code that's been commented out.

8.4. Use `TODO: ` for missing features and `FIXME: ` for known broken code. You may include non-standard comments as follows:  
	(i) `CHECK: ` for code that may need to be fixed later.  
	(ii) `CLEANUP: ` for code that is poorly optimised.  

----------------

# IV. Code structure

```
1. Imports
2. Constants and enums
3. Classes
    3.1. Class properties
        (i) Constants (readonly/static)
        (ii) Public properties
        (iii) Protected properties
        (iv) Private properties
        
    3.2. Constructor
        (i) Assign properties
        (ii) Call setup/initialisation methods
        
    3.3. Initialisation functions (non-constructor setup)
    3.4. Class methods
        (i) Static methods
            (a) Factory/constructor methods
            (b) Public static methods
            (c) Protected static methods
            (d) Private static methods
            
        (ii) Instance methods
            (a) Public
            (b) Protected
            (c) Private
            
4. Helper classes/interfaces
5. Functions outside classes
```

### 1. Imports:  
&nbsp;&nbsp;&nbsp;&nbsp;1.1. Order imports as follows:  
    
>1. External dependencies
>2. Internal modules
>3. Types
>4. Styles or assets

1.2. Alphabetise imports within groups by source/package name.  
1.3. Use relative paths consistently (e.g. ./path/to/file OR ../path/to/file, not both).  
1.4. Place one blank line between imports and constants/enums.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) If there are no constants/enums between the import and main class, disregard this.  

### 2. Constants and enums

2.1. Include only constants local to the class.  
2.2. Group constants by domain/usage and alphabetise within groups.  
2.3. Constants and enums may be placed in the same group; otherwise, constants come first.  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Example:
	    
	    const STATUS_TIMEOUT = 5000; // ms
	    enum Status {
	        OK = 200,
	        BAD_REQUEST = 400,
	        FORBIDDEN = 403,
	    }
	    
	    const DEFAULT_COLORS: Color[] = ['#FF0000','#00FF00','#000FF'];
	    
2.4. Place two blank lines between constants/enums and the main class.

### 3. Class structure

3.1. Class properties:  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Follow variable naming guidelines.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) Do not include the class name or type unless necessary to distinguish from similar properties.  
  &nbsp;&nbsp;&nbsp;&nbsp;(iii) Include units or context in the name only if necessary to distinguish from other variables. 
&nbsp;&nbsp;&nbsp;&nbsp;(iv) Use optional `prop?: type` when a property may be omitted entirely.[^*]  
&nbsp;&nbsp;&nbsp;&nbsp;(v) Use `Type | undefined` when the property exists but may not immediately hold a value.[^*]  
   &nbsp;&nbsp;&nbsp;&nbsp;(vi). Units or context may be given in an inline comment. For example:  
	    
	    class Item3D {
	        name: string;
	        globalPosition: Vector3D;
	        localPosition: Vector3D; // In metres.
	    }


3.2. Class constructor:  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Place two blank lines between the properties and constructor.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) Constructor parameters should have the same name as the properties they initialise.  
   &nbsp;&nbsp;&nbsp;&nbsp;(iii) Prefer initialising properties like so: `this.property = parameter`.[^*]  

3.3. Initialisation functions — i.e. any functions run in the class constructor.  
3.4. Static methods:  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Factory/constructor methods should follow function name guidelines.  
&nbsp;&nbsp;&nbsp;&nbsp;(ii) Additionally, they should begin with a word such as "from" or "create" or "new" (whichever avoids conflict with the programming language).  
&nbsp;&nbsp;&nbsp;&nbsp;(iii) The purpose of having an additional construction method should be clearly documented.  

3.5. Instance methods:  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Use two newlines to separate the static methods and instance methods sections.  

3.6. Sub-order both static and instance class methods (within sections) as follows:  
	
>1. Orchestration (high-level (e.g. render(), update(), process())
>2. Query (getters)
>3. Mutation (setters)
>4. Utility (helpers/low-level)
       
3.6. Class methods in the same section should be separated by a single blank line.  
3.7. Place two blank lines between class definitions.  
3.8. Class method names should follow function name guidelines. Additionally:  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Query methods should begin with "get", "is", "has", "can", etc.  
&nbsp;&nbsp;&nbsp;&nbsp;(ii) Mutation methods should begin with "set", "add", "remove", etc.  

### 4. Helper classes/interfaces, 5. Functions outside classes
4.1. The relevant guidelines for classes or functions should be followed.  
4.2. Alphabetise unless an intrinsic order presents itself.  
4.3. Consider moving long sections to another file.  
4.4. Prefer importing from another file over `export` or `public` access modifiers.  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) That is to say, keeping a designated "utility functions/classes" file may be a cleaner option.  

----------------

# V. Miscellaneous

### 1. Function and property names
1.1. Function names should be short and describe an action.  
1.2. Functions must declare return types and access modifiers explicitly.[^*]  
1.3. Parameter ordering:  
   &nbsp;&nbsp;&nbsp;&nbsp;(i) Where one parameter depends on another parameter for its value, the independent parameter should come first.  
   &nbsp;&nbsp;&nbsp;&nbsp;(ii) Parameters pertaining to a name or ID should generally come first.  
   &nbsp;&nbsp;&nbsp;&nbsp;(iii) Subject, then object.  
   &nbsp;&nbsp;&nbsp;&nbsp;(iv) Optional parameters last, with defaults specified.  
   &nbsp;&nbsp;&nbsp;&nbsp;(v) Place boolean flags at the very end.  
   &nbsp;&nbsp;&nbsp;&nbsp;(vi) Group logically related parameters.  
   &nbsp;&nbsp;&nbsp;&nbsp;(vii) If ambiguity remains, order parameters in the order they are used, or in natural reading order for clarity.  

### 2. Scope

2.1. Prefer `const` over `let`, and `let` over `var`. Avoid `var` unless absolutely necessary.[^*]  
2.2. In general, prefer the narrowest possible scope.  
2.3. Pre-declared long constants may be treated as assets and placed in separate files, grouped by usage and alphabetised.  

### 3. TypeScript-specific:[^*]  

3.1. Avoid `any`. Prefer `unknown` when a variable is intentionally untyped.  
&nbsp;&nbsp;&nbsp;&nbsp;(i) Use `any` only when interfacing with untyped external code.  
3.2. Use `readonly` for class properties that are not meant to be reassigned after construction.


[^*]: Feature referenced may be specific to TypeScript.