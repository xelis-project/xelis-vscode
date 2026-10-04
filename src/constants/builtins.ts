import { BuiltinConstant, BuiltinFunction } from '../types';

const freeFunctions: BuiltinFunction[] = [
    {
        name: 'println',
        signature: 'println(message: any)',
        documentation: 'Prints a value to standard output using its display representation.'
    },
    {
        name: 'print',
        signature: 'print(message: any)',
        documentation: 'Prints a value to standard output without a trailing newline.'
    },
    {
        name: 'debug',
        signature: 'debug(message: any)',
        documentation: 'Prints a value to standard output using its debug representation.'
    },
    {
        name: 'panic',
        signature: 'panic(message: any) -> any',
        documentation: 'Stops execution with the provided panic message.'
    },
    {
        name: 'assert',
        signature: 'assert(condition: bool)',
        documentation: 'Fails execution if the condition is false.'
    },
    {
        name: 'is_same_ptr',
        signature: 'is_same_ptr(left: any, right: any) -> bool',
        documentation: 'Returns true when both values point to the same underlying value.'
    },
    {
        name: 'require',
        signature: 'require(condition: bool, message: string)',
        documentation: 'Fails execution with the message if the condition is false.'
    },
    {
        name: 'clone',
        signature: 'clone() -> T',
        documentation: 'Returns a deep clone of the value.',
        receivers: ['any']
    }
];

const stringMethods: BuiltinFunction[] = [
    { name: 'len', signature: 'len() -> u32', documentation: 'Returns the byte length of the string.', receivers: ['string'] },
    { name: 'is_empty', signature: 'is_empty() -> bool', documentation: 'Returns true when the string has no bytes.', receivers: ['string'] },
    { name: 'trim', signature: 'trim() -> string', documentation: 'Returns a copy of the string without leading or trailing whitespace.', receivers: ['string'] },
    { name: 'contains', signature: 'contains(substring: string) -> bool', documentation: 'Returns true when the string contains the substring.', receivers: ['string'] },
    { name: 'contains_ignore_case', signature: 'contains_ignore_case(substring: string) -> bool', documentation: 'Returns true when the string contains the substring, ignoring case.', receivers: ['string'] },
    { name: 'to_uppercase', signature: 'to_uppercase() -> string', documentation: 'Returns an uppercase copy of the string.', receivers: ['string'] },
    { name: 'to_lowercase', signature: 'to_lowercase() -> string', documentation: 'Returns a lowercase copy of the string.', receivers: ['string'] },
    { name: 'to_bytes', signature: 'to_bytes() -> bytes', documentation: 'Returns the UTF-8 bytes of the string.', receivers: ['string', 'array'] },
    { name: 'index_of', signature: 'index_of(substring: string) -> optional<u32>', documentation: 'Returns the first byte index of the substring, or null if it is absent.', receivers: ['string'] },
    { name: 'last_index_of', signature: 'last_index_of(substring: string) -> optional<u32>', documentation: 'Returns the last byte index of the substring, or null if it is absent.', receivers: ['string'] },
    { name: 'replace', signature: 'replace(from: string, to: string) -> string', documentation: 'Returns a copy with every occurrence of one substring replaced by another.', receivers: ['string'] },
    { name: 'starts_with', signature: 'starts_with(prefix: string) -> bool', documentation: 'Returns true when the string starts with the prefix.', receivers: ['string'] },
    { name: 'ends_with', signature: 'ends_with(suffix: string) -> bool', documentation: 'Returns true when the string ends with the suffix.', receivers: ['string'] },
    { name: 'split', signature: 'split(separator: string) -> string[]', documentation: 'Splits the string by the separator and returns the parts.', receivers: ['string'] },
    { name: 'char_at', signature: 'char_at(index: u32) -> optional<string>', documentation: 'Returns the character at the index as a one-character string, or null if out of bounds.', receivers: ['string'] },
    { name: 'matches', signature: 'matches(pattern: string) -> string[]', documentation: 'Returns all non-overlapping matches of the pattern.', receivers: ['string'] },
    { name: 'substring', signature: 'substring(start: u32) -> optional<string>', documentation: 'Returns the substring from the byte index to the end, or null if invalid.', receivers: ['string'] },
    { name: 'substring_range', signature: 'substring_range(start: u32, end: u32) -> optional<string>', documentation: 'Returns the substring in the byte range, or null if invalid.', receivers: ['string'] }
];

const arrayMethods: BuiltinFunction[] = [
    { name: 'len', signature: 'len() -> u32', documentation: 'Returns the number of elements in the array.', receivers: ['array'] },
    { name: 'push', signature: 'push(element: T)', documentation: 'Appends an element to the end of the array.', receivers: ['array'] },
    { name: 'pop', signature: 'pop() -> optional<T>', documentation: 'Removes and returns the last element, or null when empty.', receivers: ['array'] },
    { name: 'remove', signature: 'remove(index: u32) -> T', documentation: 'Removes and returns the element at the index, shifting later elements left.', receivers: ['array'] },
    { name: 'swap_remove', signature: 'swap_remove(index: u32) -> T', documentation: 'Removes and returns the element at the index by swapping in the last element.', receivers: ['array'] },
    { name: 'insert', signature: 'insert(index: u32, element: T)', documentation: 'Inserts an element at the index, shifting later elements right.', receivers: ['array'] },
    { name: 'index_of', signature: 'index_of(element: T) -> optional<u32>', documentation: 'Returns the first index of the element, or null when absent.', receivers: ['array'] },
    { name: 'slice', signature: 'slice(range: range<u32>) -> T[]', documentation: 'Returns a shallow slice of the array for the range.', receivers: ['array', 'bytes'] },
    { name: 'contains', signature: 'contains(element: T) -> bool', documentation: 'Returns true when the array contains the element.', receivers: ['array', 'bytes', 'range'] },
    { name: 'get', signature: 'get(index: u32) -> optional<T>', documentation: 'Returns the element at the index, or null if out of bounds.', receivers: ['array', 'bytes', 'map'] },
    { name: 'first', signature: 'first() -> optional<T>', documentation: 'Returns the first element, or null when empty.', receivers: ['array', 'bytes'] },
    { name: 'last', signature: 'last() -> optional<T>', documentation: 'Returns the last element, or null when empty.', receivers: ['array', 'bytes'] },
    { name: 'extend', signature: 'extend(other: T[])', documentation: 'Appends all elements from another array.', receivers: ['array', 'bytes'] },
    { name: 'split_off', signature: 'split_off(index: u32) -> T[]', documentation: 'Splits the array at the index, keeping the first part and returning the second.', receivers: ['array', 'bytes'] },
    { name: 'truncate', signature: 'truncate(size: u32)', documentation: 'Shortens the array to the requested size.', receivers: ['array', 'bytes'] },
    { name: 'concat', signature: 'concat() -> T[]', documentation: 'Flattens one level of nested arrays into a single array.', receivers: ['array'] },
    { name: 'iter', signature: 'iter() -> Iterator<T>', documentation: 'Creates an iterator over the array elements.', receivers: ['array'] }
];

const bytesMethods: BuiltinFunction[] = [
    { name: 'len', signature: 'len() -> u32', documentation: 'Returns the number of bytes.', receivers: ['bytes'] },
    { name: 'push', signature: 'push(byte: u8)', documentation: 'Appends one byte to the end.', receivers: ['bytes'] },
    { name: 'pop', signature: 'pop() -> optional<u8>', documentation: 'Removes and returns the last byte, or null when empty.', receivers: ['bytes'] },
    { name: 'remove', signature: 'remove(index: u32) -> u8', documentation: 'Removes and returns the byte at the index, shifting later bytes left.', receivers: ['bytes'] },
    { name: 'contains', signature: 'contains(byte: u8) -> bool', documentation: 'Returns true when the byte sequence contains the byte.', receivers: ['bytes'] },
    { name: 'get', signature: 'get(index: u32) -> optional<u8>', documentation: 'Returns the byte at the index, or null if out of bounds.', receivers: ['bytes'] },
    { name: 'first', signature: 'first() -> optional<u8>', documentation: 'Returns the first byte, or null when empty.', receivers: ['bytes'] },
    { name: 'last', signature: 'last() -> optional<u8>', documentation: 'Returns the last byte, or null when empty.', receivers: ['bytes'] },
    { name: 'to_array', signature: 'to_array() -> u8[]', documentation: 'Converts the bytes to an array of u8 values.', receivers: ['bytes'] },
    { name: 'to_hex', signature: 'to_hex() -> string', documentation: 'Encodes the bytes as a lowercase hexadecimal string.', receivers: ['bytes'] }
];

const optionalMethods: BuiltinFunction[] = [
    { name: 'is_none', signature: 'is_none() -> bool', documentation: 'Returns true when the optional value is null.', receivers: ['optional'] },
    { name: 'is_some', signature: 'is_some() -> bool', documentation: 'Returns true when the optional value contains a value.', receivers: ['optional'] },
    { name: 'unwrap', signature: 'unwrap() -> T', documentation: 'Returns the contained value or fails if it is null.', receivers: ['optional'] },
    { name: 'unwrap_or', signature: 'unwrap_or(default: T) -> T', documentation: 'Returns the contained value or the provided default when it is null.', receivers: ['optional'] },
    { name: 'expect', signature: 'expect(message: string) -> T', documentation: 'Returns the contained value or fails with the message when it is null.', receivers: ['optional'] },
    { name: 'unwrap_or_else', signature: 'unwrap_or_else(fn: closure(T) -> T) -> T', documentation: 'Returns the contained value or calls the fallback closure when it is null.', receivers: ['optional'] }
];

const mapMethods: BuiltinFunction[] = [
    { name: 'len', signature: 'len() -> u32', documentation: 'Returns the number of entries in the map.', receivers: ['map'] },
    { name: 'contains_key', signature: 'contains_key(key: K) -> bool', documentation: 'Returns true when the map contains the key.', receivers: ['map'] },
    { name: 'get', signature: 'get(key: K) -> optional<V>', documentation: 'Returns the value for the key, or null when absent.', receivers: ['map'] },
    { name: 'insert', signature: 'insert(key: K, value: V) -> optional<V>', documentation: 'Inserts a key-value pair and returns the previous value, or null.', receivers: ['map'] },
    { name: 'shift_remove', signature: 'shift_remove(key: K) -> optional<V>', documentation: 'Removes a key while preserving order and returns its value, or null.', receivers: ['map'] },
    { name: 'swap_remove', signature: 'swap_remove(key: K) -> optional<V>', documentation: 'Removes a key by swapping with the last entry and returns its value, or null.', receivers: ['map'] },
    { name: 'clear', signature: 'clear()', documentation: 'Removes all entries from the map.', receivers: ['map'] },
    { name: 'keys', signature: 'keys() -> K[]', documentation: 'Returns all keys in insertion order.', receivers: ['map'] },
    { name: 'values', signature: 'values() -> V[]', documentation: 'Returns all values in insertion order.', receivers: ['map'] },
    { name: 'entries', signature: 'entries() -> (K, V)[]', documentation: 'Returns all key-value pairs in insertion order.', receivers: ['map'] }
];

const rangeMethods: BuiltinFunction[] = [
    { name: 'contains', signature: 'contains(element: T) -> bool', documentation: 'Returns true when the range contains the element.', receivers: ['range'] },
    { name: 'collect', signature: 'collect() -> T[]', documentation: 'Collects all values in the range into an array.', receivers: ['range'] },
    { name: 'max', signature: 'max() -> T', documentation: 'Returns the range upper bound.', receivers: ['range'] },
    { name: 'min', signature: 'min() -> T', documentation: 'Returns the range lower bound.', receivers: ['range'] },
    { name: 'count', signature: 'count() -> T', documentation: 'Returns the number of values in the range.', receivers: ['range'] }
];

const iteratorMethods: BuiltinFunction[] = [
    { name: 'next', signature: 'next() -> optional<T>', documentation: 'Advances the iterator and returns the next value, or null when exhausted.', receivers: ['iterator'] },
    { name: 'count', signature: 'count() -> u32', documentation: 'Consumes the iterator and returns how many values it yields.', receivers: ['iterator'] },
    { name: 'skip', signature: 'skip(n: u32) -> Iterator<T>', documentation: 'Returns an iterator that skips the first n values.', receivers: ['iterator'] },
    { name: 'take', signature: 'take(n: u32) -> Iterator<T>', documentation: 'Returns an iterator that yields at most n values.', receivers: ['iterator'] },
    { name: 'chain', signature: 'chain(other: Iterator<T>) -> Iterator<T>', documentation: 'Returns an iterator that yields this iterator followed by another.', receivers: ['iterator'] },
    { name: 'enumerate', signature: 'enumerate() -> Iterator<(u32, T)>', documentation: 'Returns an iterator of index-value pairs.', receivers: ['iterator'] },
    { name: 'rev', signature: 'rev() -> Iterator<T>', documentation: 'Returns an iterator that yields values in reverse order when supported.', receivers: ['iterator'] },
    { name: 'collect', signature: 'collect() -> T[]', documentation: 'Consumes the iterator and returns all yielded values as an array.', receivers: ['iterator'] },
    { name: 'zip', signature: 'zip(other: Iterator<U>) -> Iterator<(T, U)>', documentation: 'Pairs values from two iterators until either is exhausted.', receivers: ['iterator'] },
    { name: 'flatten', signature: 'flatten() -> Iterator<T>', documentation: 'Flattens an iterator of iterators into a single iterator.', receivers: ['iterator'] },
    { name: 'sum', signature: 'sum() -> T', documentation: 'Consumes the iterator and returns the sum of its values.', receivers: ['iterator'] },
    { name: 'map', signature: 'map(mapper: closure(T) -> U) -> Iterator<U>', documentation: 'Returns a lazy iterator that applies the mapper closure to each value.', receivers: ['iterator'] },
    { name: 'filter', signature: 'filter(predicate: closure(T) -> bool) -> Iterator<T>', documentation: 'Returns a lazy iterator that keeps values accepted by the predicate.', receivers: ['iterator'] },
    { name: 'for_each', signature: 'for_each(f: closure(T))', documentation: 'Consumes the iterator and calls the closure for each value.', receivers: ['iterator'] },
    { name: 'find', signature: 'find(predicate: closure(T) -> bool) -> optional<T>', documentation: 'Consumes the iterator until a value matches the predicate, returning it or null.', receivers: ['iterator'] },
    { name: 'any', signature: 'any(predicate: closure(T) -> bool) -> bool', documentation: 'Returns true when any yielded value matches the predicate.', receivers: ['iterator'] },
    { name: 'all', signature: 'all(predicate: closure(T) -> bool) -> bool', documentation: 'Returns true when every yielded value matches the predicate.', receivers: ['iterator'] },
    { name: 'fold', signature: 'fold(init: T, f: closure(T, T) -> T) -> T', documentation: 'Consumes the iterator and combines values with an accumulator closure.', receivers: ['iterator'] },
    { name: 'position', signature: 'position(predicate: closure(T) -> bool) -> optional<u32>', documentation: 'Returns the index of the first value matching the predicate, or null.', receivers: ['iterator'] }
];

const integerMethods: BuiltinFunction[] = [
    { name: 'checked_add', signature: 'checked_add(other: T) -> optional<T>', documentation: 'Checked addition, returning null on overflow.', receivers: ['integer'] },
    { name: 'checked_sub', signature: 'checked_sub(other: T) -> optional<T>', documentation: 'Checked subtraction, returning null on underflow.', receivers: ['integer'] },
    { name: 'checked_mul', signature: 'checked_mul(other: T) -> optional<T>', documentation: 'Checked multiplication, returning null on overflow.', receivers: ['integer'] },
    { name: 'checked_div', signature: 'checked_div(other: T) -> optional<T>', documentation: 'Checked division, returning null on overflow or division by zero.', receivers: ['integer'] },
    { name: 'checked_rem', signature: 'checked_rem(other: T) -> optional<T>', documentation: 'Checked remainder, returning null on division by zero.', receivers: ['integer'] },
    { name: 'checked_pow', signature: 'checked_pow(exponent: u32) -> optional<T>', documentation: 'Checked exponentiation, returning null on overflow.', receivers: ['integer'] },
    { name: 'checked_shl', signature: 'checked_shl(shl: u32) -> optional<T>', documentation: 'Checked left shift.', receivers: ['integer'] },
    { name: 'checked_shr', signature: 'checked_shr(shr: u32) -> optional<T>', documentation: 'Checked right shift.', receivers: ['integer'] },
    { name: 'wrapping_add', signature: 'wrapping_add(other: T) -> T', documentation: 'Wrapping addition.', receivers: ['integer'] },
    { name: 'wrapping_sub', signature: 'wrapping_sub(other: T) -> T', documentation: 'Wrapping subtraction.', receivers: ['integer'] },
    { name: 'wrapping_mul', signature: 'wrapping_mul(other: T) -> T', documentation: 'Wrapping multiplication.', receivers: ['integer'] },
    { name: 'wrapping_div', signature: 'wrapping_div(other: T) -> T', documentation: 'Wrapping division.', receivers: ['integer'] },
    { name: 'wrapping_rem', signature: 'wrapping_rem(other: T) -> T', documentation: 'Wrapping remainder.', receivers: ['integer'] },
    { name: 'wrapping_pow', signature: 'wrapping_pow(exponent: u32) -> T', documentation: 'Wrapping exponentiation.', receivers: ['integer'] },
    { name: 'saturating_add', signature: 'saturating_add(other: T) -> T', documentation: 'Saturating addition.', receivers: ['integer'] },
    { name: 'saturating_sub', signature: 'saturating_sub(other: T) -> T', documentation: 'Saturating subtraction.', receivers: ['integer'] },
    { name: 'saturating_mul', signature: 'saturating_mul(other: T) -> T', documentation: 'Saturating multiplication.', receivers: ['integer'] },
    { name: 'saturating_div', signature: 'saturating_div(other: T) -> T', documentation: 'Saturating division.', receivers: ['integer'] },
    { name: 'saturating_pow', signature: 'saturating_pow(exponent: u32) -> T', documentation: 'Saturating exponentiation.', receivers: ['integer'] },
    { name: 'pow', signature: 'pow(exponent: u32) -> T', documentation: 'Raises the value to the given power.', receivers: ['integer'] },
    { name: 'sqrt', signature: 'sqrt() -> T', documentation: 'Returns the integer square root of the value.', receivers: ['integer'] },
    { name: 'min', signature: 'min(other: T) -> T', documentation: 'Returns the smaller of the two values.', receivers: ['integer'] },
    { name: 'max', signature: 'max(other: T) -> T', documentation: 'Returns the larger of the two values.', receivers: ['integer'] },
    { name: 'leading_ones', signature: 'leading_ones() -> u32', documentation: 'Returns the number of leading ones in the binary representation.', receivers: ['integer'] },
    { name: 'trailing_ones', signature: 'trailing_ones() -> u32', documentation: 'Returns the number of trailing ones in the binary representation.', receivers: ['integer'] },
    { name: 'count_ones', signature: 'count_ones() -> u32', documentation: 'Returns the number of ones in the binary representation.', receivers: ['integer'] },
    { name: 'leading_zeros', signature: 'leading_zeros() -> u32', documentation: 'Returns the number of leading zeros in the binary representation.', receivers: ['integer'] },
    { name: 'trailing_zeros', signature: 'trailing_zeros() -> u32', documentation: 'Returns the number of trailing zeros in the binary representation.', receivers: ['integer'] },
    { name: 'count_zeros', signature: 'count_zeros() -> u32', documentation: 'Returns the number of zeros in the binary representation.', receivers: ['integer'] },
    { name: 'rotate_left', signature: 'rotate_left(n: u32) -> T', documentation: 'Rotates the bits to the left by n.', receivers: ['integer'] },
    { name: 'rotate_right', signature: 'rotate_right(n: u32) -> T', documentation: 'Rotates the bits to the right by n.', receivers: ['integer'] },
    { name: 'reverse_bits', signature: 'reverse_bits() -> T', documentation: 'Returns the value with its bits reversed.', receivers: ['integer'] },
    { name: 'to_be_bytes', signature: 'to_be_bytes() -> bytes', documentation: 'Returns the big-endian byte representation.', receivers: ['integer'] },
    { name: 'to_le_bytes', signature: 'to_le_bytes() -> bytes', documentation: 'Returns the little-endian byte representation.', receivers: ['integer'] },
    { name: 'to_string', signature: 'to_string(base: u32) -> string', documentation: 'Converts the value to a string in the requested base.', receivers: ['integer'] }
];

const staticFunctions: BuiltinFunction[] = [
    { name: 'from_hex', signature: 'bytes::from_hex(hex_string: string) -> bytes', documentation: 'Decodes a hexadecimal string into bytes.', isStatic: true, ownerType: 'bytes' },
    { name: 'from_be_bytes', signature: 'u64::from_be_bytes(bytes: bytes) -> u64', documentation: 'Builds a numeric value from big-endian bytes.', isStatic: true, ownerType: 'integer' },
    { name: 'from_le_bytes', signature: 'u64::from_le_bytes(bytes: bytes) -> u64', documentation: 'Builds a numeric value from little-endian bytes.', isStatic: true, ownerType: 'integer' },
    { name: 'once', signature: 'Iterator::once(value: T) -> Iterator<T>', documentation: 'Creates an iterator that yields one value.', isStatic: true, ownerType: 'iterator' },
    { name: 'empty', signature: 'Iterator::empty() -> Iterator<T>', documentation: 'Creates an iterator that yields no values.', isStatic: true, ownerType: 'iterator' },
    { name: 'unfold', signature: 'Iterator::unfold(seed: T, f: closure(T) -> optional<(U, T)>) -> Iterator<U>', documentation: 'Creates an iterator by repeatedly calling a closure with evolving state.', isStatic: true, ownerType: 'iterator' }
];

export const builtinFunctions: BuiltinFunction[] = [
    ...freeFunctions,
    ...stringMethods,
    ...arrayMethods,
    ...bytesMethods,
    ...optionalMethods,
    ...mapMethods,
    ...rangeMethods,
    ...iteratorMethods,
    ...integerMethods,
    ...staticFunctions
];

export const builtinConstants: BuiltinConstant[] = [
    {
        name: 'MIN',
        ownerTypes: ['u8', 'u16', 'u32', 'u64', 'u128', 'u256'],
        documentation: 'Minimum value for the numeric type.'
    },
    {
        name: 'MAX',
        ownerTypes: ['u8', 'u16', 'u32', 'u64', 'u128', 'u256'],
        documentation: 'Maximum value for the numeric type.'
    }
];
