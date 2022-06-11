package packrat;

import java.util.*;
import static packrat.ParseException.*;
import static packrat.Value.*;
import static packrat.Record.*;
import static packrat.Token.*;

// A place where everything changes
abstract class Scope {

    abstract Value evalGrammar(Rule first);

    abstract Value evalRule(Rule rule);

    abstract Value evalChoice(List<Expression> children);

    abstract Value evalTag(Expression child, String name);

    abstract Value evalSeq(List<Expression> children);

    abstract Value evalSubstr(Expression child);

    abstract Value evalTest(Expression child);

    abstract Value evalNot(Expression child);

    abstract Value evalOpt(Expression child);

    abstract Value evalZero(Expression child);

    abstract Value evalOne(Expression child);

    abstract Value evalRef(String name);

    abstract Value evalStr(String value);

    abstract Value evalChar(Predicate predicate);

    abstract Value evalNull();

    static Scope Scope(
            final String input,
            final Map<String, Rule> rules,
            final Map<Rule, Map<Integer, Record>> stores
    ) {
        return new Scope() {
            int offset;

            @Override
            Value evalGrammar(Rule first) {
                Value value = first.eval(this);
                if (value.isError()) {
                    throw ParseException(value);
                }
                if (offset != input.length()) {
                    throw ParseException(Error(input, offset, Lit("end of input")));
                }
                return value;
            }

            @Override
            Value evalRule(Rule rule) {
                Integer key = offset;
                Map<Integer, Record> store = stores.get(rule);
                Record record = store.get(key);
                if (record != null) {
                    offset = record.getOffset();
                    return record.getValue();
                }
                Value value = rule.getChild().eval(this);
                // Change to alias if this is the beginning
                if (rule.getAlias() != null && value.isError() && value.getOffset() == key) {
                    value = Error(input, value.getOffset(), Lit(rule.getAlias()));
                }
                store.put(key, Record(offset, value));
                return value;
            }

            @Override
            Value evalChoice(List<Expression> children) {
                int state = offset;
                int latest = offset;
                List<Token> tokens = new ArrayList<>();
                for (Expression child : children) {
                    Value value = child.eval(this);
                    if (!value.isError()) {
                        return value;
                    }
                    offset = state;
                    // Store only latest errors
                    if (value.getOffset() > latest) {
                        latest = value.getOffset();
                        tokens.clear();
                    }
                    if (value.getOffset() == latest) {
                        tokens.add(value.getToken());
                    }
                }
                return Error(input, latest, List(tokens));
            }

            @Override
            Value evalTag(Expression child, String name) {
                int start = offset;
                Value value = child.eval(this);
                if (value.isError()) {
                    return value;
                }
                Map<String, Value> props = new LinkedHashMap<>();
                child.put(props, value);
                return Object(input, start, name, props);
            }

            @Override
            Value evalSeq(List<Expression> children) {
                int start = offset;
                List<Value> values = new ArrayList<>();
                List<Value> pulled = new ArrayList<>();
                for (Expression child : children) {
                    Value value = child.eval(this);
                    if (value.isError()) {
                        return value;
                    }
                    values.add(value);
                    child.add(pulled, value);
                }
                switch (pulled.size()) {
                    case 0:
                        return List(input, start, values);
                    case 1:
                        return pulled.get(0);
                    default:
                        return List(input, start, pulled);
                }
            }

            @Override
            Value evalSubstr(Expression child) {
                int start = offset;
                Value value = child.eval(this);
                if (value.isError()) {
                    return value;
                }
                return String(input, start, offset);
            }

            @Override
            Value evalTest(Expression child) {
                int state = offset;
                Value value = child.eval(this);
                offset = state;
                if (value.isError()) {
                    return Error(input, offset, Empty());
                }
                return Null(input, offset);
            }

            @Override
            Value evalNot(Expression child) {
                int state = offset;
                Value value = child.eval(this);
                offset = state;
                if (value.isError()) {
                    return Null(input, offset);
                }
                return Error(input, offset, Empty());
            }

            @Override
            Value evalOpt(Expression child) {
                int state = offset;
                Value value = child.eval(this);
                if (value.isError()) {
                    offset = state;
                    return Null(input, offset);
                }
                return value;
            }

            @Override
            Value evalZero(Expression child) {
                int start = offset;
                ArrayList<Value> values = new ArrayList<>();
                while (true) {
                    int state = offset;
                    Value value = child.eval(this);
                    if (value.isError()) {
                        offset = state;
                        break;
                    }
                    values.add(value);
                }
                return List(input, start, values);
            }

            @Override
            Value evalOne(Expression child) {
                int start = offset;
                Value first = child.eval(this);
                if (first.isError()) {
                    return first;
                }
                ArrayList<Value> values = new ArrayList<>();
                values.add(first);
                while (true) {
                    int state = offset;
                    Value value = child.eval(this);
                    if (value.isError()) {
                        offset = state;
                        break;
                    }
                    values.add(value);
                }
                return List(input, start, values);
            }

            @Override
            Value evalRef(String name) {
                return rules.get(name).eval(this);
            }

            @Override
            Value evalStr(String value) {
                if (offset + value.length() <= input.length()
                        && input.regionMatches(offset, value, 0, value.length())) {
                    return String(input, offset, offset += value.length());
                } else {
                    return Error(value, offset, String(value));
                }
            }

            @Override
            Value evalChar(Predicate predicate) {
                if (offset < input.length() && predicate.accept(input.charAt(offset))) {
                    return String(input, offset, ++offset);
                } else {
                    return Error(input, offset, Predicate(predicate));
                }
            }

            @Override
            Value evalNull() {
                return Null(input, offset);
            }
        };
    }
}
