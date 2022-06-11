package packrat;

abstract class Rule {
    
    abstract String getName();

    abstract String getAlias();

    abstract Expression getChild();

    abstract Value eval(Scope scope);

    static Rule Rule(final String name, final String alias, final Expression child) {
        return new Rule() {
            @Override
            String getName() {
                return name;
            }

            @Override
            String getAlias() {
                return alias;
            }

            @Override
            Expression getChild() {
                return child;
            }

            @Override
            Value eval(Scope scope) {
                return scope.evalRule(this);
            }
        };
    }

    // Extensions
    static Rule Rule(String name, Expression child) {
        return Rule(name, null, child);
    }
}
