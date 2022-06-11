package packrat;

abstract class Record {

    abstract int getOffset();

    abstract Value getValue();

    static Record Record(final int offset, final Value value) {
        return new Record() {
            @Override
            int getOffset() {
                return offset;
            }

            @Override
            Value getValue() {
                return value;
            }
        };
    }
}
