package packrat;

public abstract class Location {

    private Location() {
    }

    public abstract int getLine();

    public abstract int getColumn();

    public abstract String getPointer();

    static Location Location(final int line, final int column, final String pointer) {
        return new Location() {
            @Override
            public int getLine() {
                return line;
            }

            @Override
            public int getColumn() {
                return column;
            }

            @Override
            public String getPointer() {
                return pointer;
            }

            @Override
            public String toString() {
                return "line " + line + " column " + column + ".\n" + pointer;
            }
        };
    }
}
