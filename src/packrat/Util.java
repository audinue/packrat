package packrat;

import java.util.*;

class Util {

    static String indent(int count) {
        String string = "";
        for (int i = 0; i < count; i++) {
            string += "  ";
        }
        return string;
    }

    static String quote(char value) {
        String string = "'";
        switch (value) {
            case '\'':
                string += "\\'";
                break;
            case '\\':
                string += "\\\\";
                break;
            case '\t':
                string += "\\t";
                break;
            case '\r':
                string += "\\r";
                break;
            case '\n':
                string += "\\n";
                break;
            default:
                string += value;
        }
        return string + "'";
    }

    static String quote(String value) {
        String string = "\"";
        for (char char_ : value.toCharArray()) {
            switch (char_) {
                case '"':
                    string += "\\\"";
                    break;
                case '\\':
                    string += "\\\\";
                    break;
                case '\t':
                    string += "\\t";
                    break;
                case '\r':
                    string += "\\r";
                    break;
                case '\n':
                    string += "\\n";
                    break;
                default:
                    string += char_;
            }
        }
        return string + "\"";
    }

    static String join(List<? extends Object> objects) {
        if (objects.isEmpty()) {
            return "nothing";
        }
        if (objects.size() == 1) {
            return objects.get(0).toString();
        } else {
            String s = "";
            for (int i = 0; i < objects.size(); i++) {
                if (i == objects.size() - 1) {
                    s += " or ";
                } else if (i > 0) {
                    s += ", ";
                }
                s += objects.get(i);
            }
            return s;
        }
    }
}
