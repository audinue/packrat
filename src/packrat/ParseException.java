package packrat;

public abstract class ParseException extends RuntimeException {

    private ParseException() {
    }

    public abstract String getInput();

    public abstract int getOffset();

    public abstract Location location();

    static ParseException ParseException(final Value value) {
        return new ParseException() {
            @Override
            public String getMessage() {
                return "Expected " + value.expected() + " but found " + value.found() + " at " + value.location();
            }

            @Override
            public String getInput() {
                return value.getInput();
            }

            @Override
            public int getOffset() {
                return value.getOffset();
            }

            @Override
            public Location location() {
                return value.location();
            }
        };
    }
}
