export interface KeywordDescription {
    [key: string]: string;
}

export type BuiltinReceiver =
    | 'string'
    | 'bytes'
    | 'array'
    | 'optional'
    | 'map'
    | 'range'
    | 'integer'
    | 'iterator'
    | 'bool'
    | 'any';

export interface BuiltinFunction {
    name: string;
    signature: string;
    documentation: string;
    receivers?: BuiltinReceiver[];
    isStatic?: boolean;
    ownerType?: string;
}

export interface BuiltinConstant {
    name: string;
    ownerTypes: string[];
    documentation: string;
}

export interface VariableTypeInfo {
    receiver?: BuiltinReceiver;
    userType?: string;
    typeArguments?: string[];
}

export interface StructField {
    name: string;
    type: string;
}

export interface StructInfo {
    name: string;
    typeParameters: string[];
    fields: StructField[];
}

export interface UserMethod {
    name: string;
    signature: string;
    parameters: string[];
    receiverName: string;
    receiverType: string;
    line: number;
    character: number;
}

export type SymbolKind = 'function' | 'struct' | 'enum' | 'hook' | 'const';

export interface SourceSymbol {
    name: string;
    kind: SymbolKind;
    line: number;
    character: number;
}

export type VariableKind = 'variable' | 'const' | 'parameter';

export interface VariableInfo {
    name: string;
    kind: VariableKind;
    line: number;
    character: number;
}

export interface FunctionSignatureInfo {
    name: string;
    signature: string;
    parameters: string[];
    line: number;
    character: number;
}

export interface EnumVariant {
    name: string;
    signature: string;
    line: number;
    character: number;
}

export interface PositionInfo {
    line: number;
    character: number;
}

export interface BracketDiagnostic extends PositionInfo {
    length: number;
    message: string;
}

export type DiagnosticSeverityName = 'error' | 'warning' | 'hint';

export interface DiagnosticData {
    name?: string;
    bracket?: string;
}

export interface DiagnosticInfo extends PositionInfo {
    length: number;
    message: string;
    severity: DiagnosticSeverityName;
    code: string;
    data?: DiagnosticData;
}

export type SemanticTokenTypeName =
    | 'function'
    | 'method'
    | 'struct'
    | 'enum'
    | 'enumMember'
    | 'type'
    | 'variable'
    | 'parameter'
    | 'modifier';

export type SemanticTokenModifierName = 'declaration' | 'readonly' | 'static';

export interface SemanticTokenInfo {
    line: number;
    character: number;
    length: number;
    type: SemanticTokenTypeName;
    modifiers: SemanticTokenModifierName[];
}

export interface FoldingRangeInfo {
    start: number;
    end: number;
}

export interface FormatOptions {
    tabSize: number;
    insertSpaces: boolean;
}
