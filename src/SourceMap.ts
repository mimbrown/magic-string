import { encode, SourceMapMappings } from './utils/sourcemapCodec.ts';

const doBtoa = (str: string) => btoa(unescape(encodeURIComponent(str)));

export interface SourceMapProperties {
  file: string | null | undefined;
  sources: (string | null)[];
  sourcesContent: (string | null)[];
  names: string[];
  mappings: SourceMapMappings;
}

export default class SourceMap {
  version = 3;
  file: string | null | undefined;
  sources: (string | null)[];
  sourcesContent: (string | null)[];
  names: string[];
  mappings: string;

	constructor(properties: SourceMapProperties) {
		this.file = properties.file;
		this.sources = properties.sources;
		this.sourcesContent = properties.sourcesContent;
		this.names = properties.names;
		this.mappings = encode(properties.mappings);
	}

	toString() {
		return JSON.stringify(this);
	}

	toUrl() {
		return 'data:application/json;charset=utf-8;base64,' + doBtoa(this.toString());
	}
}
