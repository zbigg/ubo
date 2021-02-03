export namespace schema {
  export interface String {
    type: "string";
  }

  export interface Number {
    type: "number";
    min?: number;
    max?: number;
    step?: number;
    default?: number;
  }

  export interface Array {
    type: "array";
    minOccurences?: number;
    itemType: Type;
  }

  export interface Boolean {
    type: "boolean";
    default?: boolean;
  }

  export interface Option {
    type: "option";
    min?: number;
    max?: number;
    step?: number;
    default?: false;
  }

  export interface List {
    type: "list";
    minOccurences?: number;
    itemType: Type;
  }

  export interface ObjectProperty {
    name: "string";
    required?: boolean;
    type: Type;
  }

  export interface Object {
    type: "object";
    properties: ObjectProperty[];
  }

  export interface Stream {
    type: "stream";
    dataType: Type;
  }

  export type Type = String | Number | Boolean | Option | List | Object | Stream;
}
