package packrat;

import java.util.*;
import static packrat.Scope.*;

public abstract class Grammar {

    private Grammar() {
    }

    public abstract Value parse(String input);

    static Grammar Grammar(final List<Rule> rules) {
        return new Grammar() {
            @Override
            public Value parse(String input) {
                Map<String, Rule> rulesForScope = new HashMap<>();
                Map<Rule, Map<Integer, Record>> stores = new HashMap<>();
                for (Rule rule : rules) {
                    rulesForScope.put(rule.getName(), rule);
                    stores.put(rule, new HashMap<Integer, Record>());
                }
                return Scope(input, rulesForScope, stores).evalGrammar(rules.get(0));
            }
        };
    }

    // Extensions
    static Grammar Grammar(Rule[] rules) {
        return Grammar(Arrays.asList(rules));
    }
}
