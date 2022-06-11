package packrat;

import java.util.*;
import static packrat.Util.*;

abstract class Predicate {

    abstract boolean accept(char value);

    abstract List<String> toList();
    
    static Predicate AnyChar() {
        return new Predicate() {
            @Override
            boolean accept(char value) {
                return true;
            }

            @Override
            List<String> toList() {
                return Arrays.asList("any character");
            }
        };
    }

    static Predicate Eq(final char expected) {
        return new Predicate() {
            @Override
            boolean accept(char value) {
                return value == expected;
            }

            @Override
            List<String> toList() {
                return Arrays.asList(quote(expected));
            }
        };
    }

    static Predicate Range(final char min, final char max) {
        return new Predicate() {
            @Override
            boolean accept(char value) {
                return value >= min && value <= max;
            }

            @Override
            List<String> toList() {
                return Arrays.asList(quote(min) + ".." + quote(max));
            }
        };
    }

    static Predicate Or(final List<Predicate> predicates) {
        return new Predicate() {
            @Override
            boolean accept(char value) {
                for (Predicate predicate : predicates) {
                    if (predicate.accept(value)) {
                        return true;
                    }
                }
                return false;
            }

            @Override
            List<String> toList() {
                List<String> list = new ArrayList<>();
                for (Predicate predicate : predicates) {
                    list.addAll(predicate.toList());
                }
                return list;
            }
        };
    }
}
