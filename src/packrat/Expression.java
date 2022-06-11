package packrat;

import java.util.*;
import static packrat.Predicate.*;

abstract class Expression {

    abstract Value eval(Scope scope);

    void put(Map<String, Value> props, Value value) {
        // Overriden by `Seq` and `Prop`
    }

    void add(List<Value> pulled, Value value) {
        // Overriden by `Pull`
    }

    static Expression Choice(final List<Expression> children) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalChoice(children);
            }
        };
    }

    static Expression Tag(final Expression child, final String name) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalTag(child, name);
            }
        };
    }

    static Expression Seq(final List<Expression> children) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalSeq(children);
            }

            @Override
            void put(Map<String, Value> props, Value value) {
                for (int i = 0; i < children.size(); i++) {
                    children.get(i).put(props, value.get(i));
                }
            }
        };
    }

    static Expression Prop(final String name, final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return child.eval(scope);
            }

            @Override
            void put(Map<String, Value> props, Value value) {
                props.put(name, value);
            }
        };
    }

    static Expression Pull(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return child.eval(scope);
            }

            @Override
            void add(List<Value> pulled, Value value) {
                pulled.add(value);
            }
        };
    }

    static Expression Substr(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalSubstr(child);
            }
        };
    }

    static Expression Test(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalTest(child);
            }
        };
    }

    static Expression Not(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalNot(child);
            }
        };
    }

    static Expression Opt(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalOpt(child);
            }
        };
    }

    static Expression Zero(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalZero(child);
            }
        };
    }

    static Expression One(final Expression child) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalOne(child);
            }
        };
    }

    static Expression Ref(final String name) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalRef(name);
            }
        };
    }

    static Expression Str(final String value) {
        switch (value.length()) {
            case 0:
                return Null();
            case 1:
                return Char(Eq(value.charAt(0)));
            default:
                return new Expression() {
                    @Override
                    Value eval(Scope scope) {
                        return scope.evalStr(value);
                    }
                };
        }
    }

    static Expression Char(final Predicate predicate) {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalChar(predicate);
            }
        };
    }

    static Expression Any() {
        return Char(AnyChar());
    }

    static Expression Null() {
        return new Expression() {
            @Override
            Value eval(Scope scope) {
                return scope.evalNull();
            }
        };
    }

    static Expression Char(List<Predicate> predicates) {
        switch (predicates.size()) {
            case 0:
                return Null();
            case 1:
                return Char(predicates.get(0));
            default:
                return Char(Or(predicates));
        }
    }

    // Extensions
    static Expression Choice(Expression[] children) {
        return Choice(Arrays.asList(children));
    }

    static Expression Seq(Expression[] children) {
        return Seq(Arrays.asList(children));
    }

    static Expression Char(Predicate[] predicates) {
        return Char(Arrays.asList(predicates));
    }
}
