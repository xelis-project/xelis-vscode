import { KeywordDescription } from '../types';

export const keywordDescriptions: KeywordDescription = {
    // Control Flow
    'if': 'Conditional statement for branching code execution',
    'else': 'Alternative branch of an if statement',
    'for': 'Loop construct with initialization, condition, and increment',
    'while': 'Loop that executes while a condition is true',
    'foreach': 'Loop that iterates over elements in a collection',
    'in': 'Used with foreach to specify the collection to iterate over',
    'match': 'Pattern matching expression over enums and values',
    'break': 'Exit the nearest enclosing loop',
    'continue': 'Skip to the next iteration of a loop',
    'return': 'Exit from a function and optionally return a value',

    // Declarations
    'fn': 'Function declaration keyword',
    'entry': 'Marks the public entry point of the program (must return u64)',
    'hook': 'Declares a hook function registered in the VM environment',
    'pub': 'Makes a function externally visible (public)',
    'struct': 'Define a composite data type',
    'enum': 'Define an enum type with multiple variants',
    'const': 'Declare a compile-time constant (outside functions)',
    'let': 'Declare a variable',
    'closure': 'Closure type, e.g. closure(u64) -> bool',
    'import': 'Import a local module (import resolution is not implemented yet)',
    'from': 'Import specific items from a module',
    'as': 'Cast a value into another built-in type',
    'any': 'Wildcard type used in generic declarations',

    // Types
    'bool': 'Boolean type that can be true or false',
    'u8': '8-bit unsigned integer (0 to 255)',
    'u16': '16-bit unsigned integer',
    'u32': '32-bit unsigned integer',
    'u64': '64-bit unsigned integer (default numeric type)',
    'u128': '128-bit unsigned integer',
    'u256': '256-bit unsigned integer',
    'string': 'Text string type',
    'bytes': 'Raw byte sequence, e.g. b"Hi"',
    'optional': 'Type that can contain a value or be null, e.g. optional<u64>',
    'range': 'Numeric range type usable for iteration, e.g. range<u64>',
    'map': 'Insertion-ordered key-value store, e.g. map<string, u64>',

    // Values
    'true': 'Boolean true value',
    'false': 'Boolean false value',
    'null': 'Represents the absence of a value',

    // Builtin functions
    'println': 'Print a value to the output followed by a newline',
    'print': 'Print a value to the output',
    'assert': 'Assert that a condition is true, aborting otherwise',
    'panic': 'Abort execution with an error message'
};
