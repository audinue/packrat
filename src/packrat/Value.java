package packrat;

import java.util.*;
import java.util.Map.*;
import static packrat.Location.*;
import static packrat.Util.*;

public abstract class Value implements Iterable<Value> {

    String input;
    int offset;

    private Value(String input, int offset) {
        this.input = input;
        this.offset = offset;
    }

    public final String getInput() {
        return input;
    }

    public final int getOffset() {
        return offset;
    }

    final String found() {
        if (offset < input.length()) {
            return quote(input.charAt(offset));
        }
        return "end of input";
    }

    public final Location location() {
        int start = 0;
        int length = 0;
        int line = 1;
        int column = 0;
        boolean next = false;
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            if (next) {
                if (i > offset) {
                    break;
                }
                line++;
                column = 0;
                next = false;
                start = i;
                length = 0;
            }
            if (i <= offset) {
                column++;
            }
            if (c == '\n') {
                next = true;
            } else {
                length++;
            }
        }
        if (offset == input.length()) {
            column++;
        }
        String pointer = input.substring(start, start + length) + "\n";
        for (int i = 1; i < column; i++) {
            pointer += "-";
        }
        pointer += "^";
        return Location(line, column, pointer);
    }

    public boolean isNull() {
        return false;
    }

    boolean isError() {
        return false;
    }

    Token getToken() {
        throw new UnsupportedOperationException();
    }

    final String expected() {
        return join(getToken().toList());
    }

    public String getString() {
        throw new UnsupportedOperationException();
    }

    public List<Value> getList() {
        throw new UnsupportedOperationException();
    }

    public String getTag() {
        throw new UnsupportedOperationException();
    }

    public Map<String, Value> getProps() {
        throw new UnsupportedOperationException();
    }

    @Override
    public final Iterator<Value> iterator() {
        return getList().iterator();
    }

    abstract String toString(int level);

    @Override
    public final String toString() {
        return toString(0);
    }

    static Value Null(String input, int offset) {
        return new Value(input, offset) {
            @Override
            public boolean isNull() {
                return true;
            }

            @Override
            String toString(int level) {
                return "<null>";
            }
        };
    }

    static Value Error(String input, int offset, final Token token) {
        return new Value(input, offset) {
            @Override
            boolean isError() {
                return true;
            }

            @Override
            Token getToken() {
                return token;
            }

            @Override
            String toString(int level) {
                throw new UnsupportedOperationException();
            }
        };
    }

    static Value String(final String input, final int offset, final int end) {
        return new Value(input, offset) {
            @Override
            public String getString() {
                return input.substring(offset, end);
            }

            @Override
            String toString(int level) {
                return quote(getString());
            }
        };
    }

    static Value List(String input, int offset, final List<Value> list) {
        return new Value(input, offset) {
            @Override
            public List<Value> getList() {
                return list;
            }

            @Override
            String toString(int level) {
                if (list.isEmpty()) {
                    return "[]";
                } else {
                    String string = "[\n";
                    for (Value value : list) {
                        string += indent(level + 1) + value.toString(level + 1) + "\n";
                    }
                    return string + indent(level) + "]";
                }
            }
        };
    }

    static Value Object(String input, int offset, final String tag, final Map<String, Value> props) {
        return new Value(input, offset) {
            @Override
            public String getTag() {
                return tag;
            }

            @Override
            public Map<String, Value> getProps() {
                return props;
            }

            @Override
            String toString(int level) {
                if (props.isEmpty()) {
                    return tag;
                } else {
                    String string = tag + " {\n";
                    for (Entry<String, Value> prop : props.entrySet()) {
                        string += indent(level + 1) + prop.getKey() + ": " + prop.getValue().toString(level + 1) + "\n";
                    }
                    return string + indent(level) + "}";
                }
            }
        };
    }

    // Extensions
    public final boolean isEmpty() {
        return getList().isEmpty();
    }

    public final int size() {
        return getList().size();
    }

    public final Value get(int index) {
        return getList().get(index);
    }

    public final boolean isNull(int index) {
        return get(index).isNull();
    }

    public final String getString(int index) {
        return get(index).getString();
    }

    public final Value get(String name) {
        return getProps().get(name);
    }

    public final boolean isNull(String name) {
        return get(name).isNull();
    }

    public final String getString(String name) {
        return get(name).getString();
    }
}
