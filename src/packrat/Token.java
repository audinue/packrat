package packrat;

import java.util.*;
import static packrat.Util.*;

// Basically a thunked `toList()`
abstract class Token {

    abstract List<String> toList();

    static Token Empty() {
        return new Token() {
            List<String> toList() {
                return Arrays.asList();
            }
        };
    }

    static Token Lit(final String value) {
        return new Token() {
            List<String> toList() {
                return Arrays.asList(value);
            }
        };
    }

    static Token String(final String value) {
        return new Token() {
            List<String> toList() {
                return Arrays.asList(quote(value));
            }
        };
    }

    static Token Predicate(final Predicate predicate) {
        return new Token() {
            List<String> toList() {
                return predicate.toList();
            }
        };
    }

    static Token List(final List<Token> tokens) {
        return new Token() {
            List<String> toList() {
                List<String> list = new ArrayList<>();
                for (Token token : tokens) {
                    list.addAll(token.toList());
                }
                return list;
            }
        };
    }
}
