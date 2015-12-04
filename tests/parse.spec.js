'use strict';

var parse = require('../src/parse');

describe('parse', function () {
	
	fit('can parse an integer', function () {
		
		var fn = parse('42');
		
		expect(fn).toBeDefined();
		expect(fn()).toBe(42);
	});
});