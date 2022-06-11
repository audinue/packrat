# packrat

Concrete syntax tree generating Java 7 packrat parser interpreter.

Download `packrat.jar` on the `dist`.

```java
import packrat.*;

Value result = new GrammarFactory() // Reuse for multiple grammars
	.createGrammar("Main = 'Hello ' name:( !'!' . )+ '!' -> Greeting") // Reuse for multiple parsing
	.parse("Hello John!");

System.out.println(result);
System.out.println(result.getTag());
System.out.println(result.getString("name"));
```

Outputs

```
Greeting {
	name: "John"
}
Greeting
John
```

## Expressions

- Choice `expression1 / expression2 / expressionN`
- Tag `expression -> TagName`
- Sequence `expression1 expression2 expressionN`
- Prop `propName:expression`
- Pull `^expression`
- Substring `$expression`
- Test `&expression`
- Not `!expression`
- Optional `expression?`
- Zero or More `expression*`
- One or More `expression+`
- String `"foo"` or `'bar'`
- Char `[A-Z_$]`
- Any Character `.`
