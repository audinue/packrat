package packrat;

import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import java.util.Map.*;
import static packrat.Util.*;

class Main {

    public static void main(String[] args) {
        long start;

        start = System.nanoTime();
        String input = read();
        System.out.println("Read: " + (System.nanoTime() - start) / 1000000l);

        start = System.nanoTime();
        Grammar packrat1 = GrammarFactory.PACKRAT;
        System.out.println("Init: " + (System.nanoTime() - start) / 1000000l);

        start = System.nanoTime();
        Value result = packrat1.parse(input);
        System.out.println("Parse: " + (System.nanoTime() - start) / 1000000l);

        start = System.nanoTime();
        Grammar packrat2 = GrammarFactory.toGrammar(result);
        System.out.println("Transform: " + (System.nanoTime() - start) / 1000000l);
        
//        write("packrat1.txt", dump(packrat1));
//        write("packrat2.txt", dump(packrat2));
        
        System.out.println("Correct: " + dump(packrat1).equals(dump(packrat2)));
    }

    static String read() {
        try {
            InputStream in = Main.class.getResourceAsStream("packrat.packrat");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            while (true) {
                int read = in.read(buffer);
                if (read == -1) {
                    break;
                }
                out.write(buffer, 0, read);
            }
            in.close();
            return new String(out.toByteArray());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    static void write(String file, String data) {
        try {
            FileOutputStream out = new FileOutputStream(file);
            out.write(data.getBytes());
            out.close();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    static String dump(Object object, int level) {
        if (object == null) {
            return "null";
        }
        if (object instanceof List) {
            if (((List) object).isEmpty()) {
                return "[]";
            } else {
                String s = "[\n";
                for (Object item : (List) object) {
                    s += indent(level + 1) + dump(item, level + 1) + "\n";
                }
                return s + indent(level) + "]";
            }
        }
        if (object instanceof Map) {
            if (((Map) object).isEmpty()) {
                return "{}";
            } else {
                String s = "{\n";
                for (Object item : ((Map) object).entrySet()) {
                    Entry entry = (Entry) item;
                    s += indent(level + 1) + entry.getKey() + ": " + dump(entry.getValue(), level + 1) + "\n";
                }
                return s + indent(level) + "}";
            }
        }
        Class type = object.getClass();
        if (type.equals(Integer.class)) {
            return String.valueOf(object);
        }
        if (type.equals(Character.class)) {
            return quote((char) object);
        }
        if (type.equals(String.class)) {
            return quote((String) object);
        }
        String name;
        if (type.getEnclosingMethod() == null) {
            name = type.getSimpleName();
        } else {
            name = type.getEnclosingMethod().getName();
        }
        Field[] fields = type.getDeclaredFields();
        if (fields.length == 0) {
            return name;
        } else {
            String s = name + " {\n";
            for (Field field : fields) {
                try {
                    field.setAccessible(true);
                    s += indent(level + 1) + field.getName().replace("val$", "") + ": " + dump(field.get(object), level + 1) + "\n";
                } catch (Exception e) {
                    throw new RuntimeException(e);
                }
            }
            return s + indent(level) + "}";
        }
    }

    static String dump(Object object) {
        return dump(object, 0);
    }
}
