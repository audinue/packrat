package packrat;

import java.util.*;
import static packrat.Expression.*;
import static packrat.Grammar.*;
import static packrat.Predicate.*;
import static packrat.Rule.*;

public final class GrammarFactory {

    static final Grammar PACKRAT = Grammar(new Rule[]{
        Rule("Grammar", Tag(Seq(new Expression[]{
            Ref("_"),
            Prop("rules", One(Seq(new Expression[]{
                Pull(Ref("Rule")),
                Ref("_")
            })))
        }), "Grammar")),
        Rule("Rule", Tag(Seq(new Expression[]{
            Prop("name", Ref("Id")),
            Prop("alias", Opt(Seq(new Expression[]{
                Ref("_"),
                Pull(Ref("String"))
            }))),
            Ref("_"),
            Str("="),
            Ref("_"),
            Prop("child", Ref("Choice"))
        }), "Rule")),
        Rule("Choice", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("head", Ref("Tag")),
                Prop("tail", One(Seq(new Expression[]{
                    Ref("_"),
                    Str("/"),
                    Ref("_"),
                    Pull(Ref("Tag"))
                })))
            }), "Choice"),
            Ref("Tag")
        })),
        Rule("Tag", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("value", Ref("Seq")),
                Ref("_"),
                Str("->"),
                Ref("_"),
                Prop("name", Ref("Id"))
            }), "Tag"),
            Ref("Seq")
        })),
        Rule("Seq", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("head", Ref("Prop")),
                Prop("tail", One(Seq(new Expression[]{
                    Ref("__"),
                    Pull(Ref("Prop"))
                })))
            }), "Seq"),
            Ref("Prop")
        })),
        Rule("Prop", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("op", Choice(new Expression[]{
                    Tag(Str("^"), "Pull"),
                    Tag(Seq(new Expression[]{
                        Prop("name", Ref("Id")),
                        Str(":")
                    }), "Key")
                })),
                Prop("value", Ref("Prefix"))
            }), "Prop"),
            Ref("Prefix")
        })),
        Rule("Prefix", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("op", Char(new Predicate[]{
                    Eq('$'),
                    Eq('&'),
                    Eq('!')
                })),
                Prop("value", Ref("Postfix"))
            }), "Prefix"),
            Ref("Postfix")
        })),
        Rule("Postfix", Choice(new Expression[]{
            Tag(Seq(new Expression[]{
                Prop("value", Ref("Term")),
                Prop("op", Char(new Predicate[]{
                    Eq('?'),
                    Eq('*'),
                    Eq('+')
                }))
            }), "Postfix"),
            Ref("Term")
        })),
        Rule("Term", Choice(new Expression[]{
            Ref("Ref"),
            Ref("Str"),
            Ref("Char"),
            Ref("Any"),
            Ref("Group")
        })),
        Rule("Ref", Tag(Seq(new Expression[]{
            Prop("name", Ref("Id")),
            Not(Seq(new Expression[]{
                Opt(Seq(new Expression[]{
                    Ref("_"),
                    Ref("Str")
                })),
                Ref("_"),
                Str("=")
            }))
        }), "Ref")),
        Rule("Str", Tag(Prop("value", Ref("String")), "Str")),
        Rule("Char", "char", Tag(Seq(new Expression[]{
            Str("["),
            Prop("predicates", Zero(Choice(new Expression[]{
                Ref("Escape"),
                Ref("Range"),
                Ref("Eq")
            }))),
            Str("]")
        }), "Char")),
        Rule("Any", Tag(Str("."), "Any")),
        Rule("Group", Seq(new Expression[]{
            Str("("),
            Ref("_"),
            Pull(Ref("Choice")),
            Ref("_"),
            Str(")")
        })),
        Rule("Escape", Tag(Seq(new Expression[]{
            Str("\\"),
            Prop("value", Any())
        }), "Escape")),
        Rule("Range", Tag(Seq(new Expression[]{
            Prop("min", Any()),
            Str("-"),
            Prop("max", Any())
        }), "Range")),
        Rule("Eq", Tag(Seq(new Expression[]{
            Not(Str("]")),
            Prop("value", Any())
        }), "Eq")),
        Rule("String", "string", Choice(new Expression[]{
            Seq(new Expression[]{
                Str("'"),
                Pull(Substr(Zero(Choice(new Expression[]{
                    Seq(new Expression[]{
                        Str("\\"),
                        Any()
                    }),
                    Seq(new Expression[]{
                        Not(Str("'")),
                        Any()
                    })
                })))),
                Str("'")
            }),
            Seq(new Expression[]{
                Str("\""),
                Pull(Substr(Zero(Choice(new Expression[]{
                    Seq(new Expression[]{
                        Str("\\"),
                        Any()
                    }),
                    Seq(new Expression[]{
                        Not(Str("\"")),
                        Any()
                    })
                })))),
                Str("\"")
            })
        })),
        Rule("Id", "identifier", Substr(Seq(new Expression[]{
            Char(new Predicate[]{
                Range('A', 'Z'),
                Range('a', 'z'),
                Eq('_')
            }),
            Zero(Char(new Predicate[]{
                Range('A', 'Z'),
                Range('a', 'z'),
                Range('0', '9'),
                Eq('_')
            }))
        }))),
        Rule("_", Zero(Ref("Skip"))),
        Rule("__", One(Ref("Skip"))),
        Rule("Skip", "whitespace", Choice(new Expression[]{
            Char(new Predicate[]{
                Eq(' '),
                Eq('\t'),
                Eq('\r'),
                Eq('\n')
            }),
            Seq(new Expression[]{
                Str("//"),
                Zero(Seq(new Expression[]{
                    Not(Char(new Predicate[]{
                        Eq('\r'),
                        Eq('\n')
                    })),
                    Any()
                }))
            }),
            Seq(new Expression[]{
                Str("/*"),
                Zero(Seq(new Expression[]{
                    Not(Str("*/")),
                    Any()
                })),
                Str("*/")
            })
        }))
    });

    static Grammar toGrammar(Value grammar) {
        List<Rule> rules = new ArrayList<>();
        for (Value rule : grammar.get("rules")) {
            rules.add(toRule(rule));
        }
        return Grammar(rules);
    }

    static Rule toRule(Value rule) {
        return Rule(
                rule.getString("name"),
                rule.isNull("alias") ? null : rule.getString("alias"),
                toExpression(rule.get("child"))
        );
    }

    static Expression toExpression(Value expression) {
        switch (expression.getTag()) {
            case "Choice": {
                List<Expression> children = new ArrayList<>();
                children.add(toExpression(expression.get("head")));
                for (Value child : expression.get("tail")) {
                    children.add(toExpression(child));
                }
                return Choice(children);
            }
            case "Tag":
                return Tag(toExpression(expression.get("value")), expression.getString("name"));
            case "Seq": {
                List<Expression> children = new ArrayList<>();
                children.add(toExpression(expression.get("head")));
                for (Value child : expression.get("tail")) {
                    children.add(toExpression(child));
                }
                return Seq(children);
            }
            case "Prop": {
                Expression value = toExpression(expression.get("value"));
                Value op = expression.get("op");
                switch (op.getTag()) {
                    case "Pull":
                        return Pull(value);
                    case "Key":
                        return Prop(op.getString("name"), value);
                    default:
                        throw new UnsupportedOperationException();
                }
            }
            case "Prefix": {
                Expression value = toExpression(expression.get("value"));
                switch (expression.getString("op")) {
                    case "$":
                        return Substr(value);
                    case "&":
                        return Test(value);
                    case "!":
                        return Not(value);
                    default:
                        throw new UnsupportedOperationException();
                }
            }
            case "Postfix": {
                Expression value = toExpression(expression.get("value"));
                switch (expression.getString("op")) {
                    case "?":
                        return Opt(value);
                    case "*":
                        return Zero(value);
                    case "+":
                        return One(value);
                    default:
                        throw new UnsupportedOperationException();
                }
            }
            case "Ref":
                return Ref(expression.getString("name"));
            case "Str": {
                String value = expression.getString("value");
                String unescaped = "";
                for (int i = 0; i < value.length(); i++) {
                    char char_ = value.charAt(i);
                    if (char_ == '\\') {
                        char_ = value.charAt(++i);
                        switch (char_) {
                            case 't':
                                char_ = '\t';
                                break;
                            case 'r':
                                char_ = '\r';
                                break;
                            case 'n':
                                char_ = '\n';
                                break;
                        }
                    }
                    unescaped += char_;
                }
                return Str(unescaped);
            }
            case "Char": {
                List<Predicate> predicates = new ArrayList<>();
                for (Value predicate : expression.get("predicates")) {
                    predicates.add(toPredicate(predicate));
                }
                return Char(predicates);
            }
            case "Any":
                return Any();
            default:
                throw new UnsupportedOperationException();
        }
    }

    static Predicate toPredicate(Value predicate) {
        switch (predicate.getTag()) {
            case "Escape":
                char char_ = predicate.getString("value").charAt(0);
                switch (char_) {
                    case 't':
                        char_ = '\t';
                        break;
                    case 'r':
                        char_ = '\r';
                        break;
                    case 'n':
                        char_ = '\n';
                        break;
                }
                return Eq(char_);
            case "Range":
                return Range(predicate.getString("min").charAt(0), predicate.getString("max").charAt(0));
            case "Eq":
                return Eq(predicate.getString("value").charAt(0));
            default:
                throw new UnsupportedOperationException();
        }
    }
    
    public Grammar createGrammar(String input) {
        return toGrammar(PACKRAT.parse(input));
    }
}
