'use strict';

var _ = require('lodash');

var ESCAPES = { 'n': '\n', 'f': '\f', 'r': '\r', 't': '\t',
								'v': '\v', '\'': '\'', '"': '"' };

function parse (expr) {
	
	var lexer = new Lexer();
	var parser = new Parser(lexer);
	
	return parser.parse(expr);
}

function Lexer () { }

Lexer.prototype.lex = function (text) {
	
	//Tokenization done here
	this.text = text;
	this.index = 0;
	this.ch = undefined;
	this.tokens = [];
	
	while (this.index < this.text.length) {
		this.ch = this.text.charAt(this.index);
		
		if (this.isNumber(this.ch) ||
				(this.ch === '.' && this.isNumber(this.peek()))) {
			this.readNumber();
		} else if (this.ch === '\'' || this.ch === '"') {
			this.readString(this.ch);
		} else if (this.isIdent(this.ch)) {
			this.readIdent();
		} else if (this.isWhitespace(this.ch)) {
			this.index++;
		} else {
			throw 'Unexpected next character ' + this.ch;
		}
	}
	
	return this.tokens;
};

Lexer.prototype.isNumber = function (ch) {
	
	return '0' <= ch && ch <= '9'; //use lexicographical comparison
};

Lexer.prototype.readNumber = function () {
	
	var number = '';
	
	while (this.index < this.text.length) {
		var ch = this.text.charAt(this.index).toLowerCase();
		
		if (ch === '.' || this.isNumber(ch)) {
				number += ch;
		} else {
			var nextCh = this.peek();
			var prevCh = number.charAt(number.length - 1);

			if (ch === 'e' && this.isExpOperator(nextCh)) {
					number += ch;
			} else if (this.isExpOperator(ch) && prevCh === 'e' &&
								 nextCh && this.isNumber(nextCh)) {
				number += ch;
			} else if (this.isExpOperator(ch) && prevCh === 'e' &&
								 (!nextCh || !this.isNumber(nextCh))) {
				throw 'Invalid exponent';
			} else {
				break;
			}
		}
		
		this.index++;
	}
	
	this.tokens.push({
		text: number,
		value: Number(number)
	});
};

Lexer.prototype.peek = function () {
	
	return this.index < this.text.length - 1 ? this.text.charAt(this.index + 1) : false;
};

Lexer.prototype.isExpOperator = function (ch) {
	
	return ch === '-' || ch === '+' ||  this.isNumber(ch);
};

Lexer.prototype.readString = function (quote) {
	
	this.index++;
	var string = '';
	var escape = false;
	
	while (this.index < this.text.length) {
		var ch = this.text.charAt(this.index);
		
		if (escape) {
			if (ch === 'u') {
				var hex = this.text.substring(this.index + 1, this.index + 5); //next 4 chars after the 'u'
				if (!hex.match(/[\da-f]{4}/i)){
					throw 'Invalid unicode escape';
				}
				this.index += 4;
				string += String.fromCharCode(parseInt(hex, 16));
			} else {
				var replacement = ESCAPES[ch];

				if (replacement) {
					string += replacement;
				} else {
					string += ch;
				}	
			}
			escape = false;
		} else if (ch === quote) {
			this.index++;
			this.tokens.push({
				text: string,
				value: string
			});
			
			return;
		} else if (ch === '\\') {
			escape = true;
		} else {
			string += ch;
		}
		
		this.index++;
	}
	
	throw 'Unmatched quote';
};

Lexer.prototype.isIdent = function (ch) {
	
	return ((ch >= 'a'  && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || 
				  ch === '_' || ch === '$');
};

Lexer.prototype.readIdent = function () {
	
	var text = '';
	
	while (this.index < this.text.length) {
		var ch = this.text.charAt(this.index);
		
		if (this.isIdent(ch) || this.isNumber(ch)) {
			text += ch;
		} else {
			break;
		}
		
		this.index++;
	}
	
	var token = { text: text };
	this.tokens.push(token);
};

Lexer.prototype.isWhitespace = function (ch) {
	
	return (ch === ' ' || ch === '\r' || ch === '\t' ||
					ch === '\n' || ch === '\v' || ch === '\u00A0');
};

function AST (lexer) {
	
	this.lexer = lexer;
}

AST.Program = 'Program';
AST.Literal = 'Literal';

AST.prototype.ast = function (text) {

	this.tokens = this.lexer.lex(text);
	
	//AST building done here
	return this.program();
};

AST.prototype.program = function () {
	
	return { 
		type: AST.Program,
		body: this.primary()
	};
};

AST.prototype.primary = function () {

	if (this.constants.hasOwnProperty(this.tokens[0].text)) {
		
		return this.constants[this.tokens[0].text];
	} else {
		
		return this.constant();
	}
};

AST.prototype.constant = function () {
	
	return {
		type: AST.Literal,
		value: this.tokens[0].value
	};
};

AST.prototype.constants = {
	'null': { type: AST.Literal, value: null },
	'true': { type: AST.Literal, value: true },
	'false': { type: AST.Literal, value: false }
};

function ASTCompiler (astBuilder) {
	
	this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function (text) {
	
	var ast = this.astBuilder.ast(text);
	
	//AST compilation  done here
	this.state = { body: [] };
	this.recurse(ast);
	
	//js-hint does not like 'eval', which is basically the same as calling the Function constructor
	/* jshint -W054 */
	return new Function(this.state.body.join(''));
	/* jshint +W054 */
};

ASTCompiler.prototype.recurse = function (ast) {
	
	switch (ast.type) {
		case AST.Program:
			this.state.body.push('return ' + this.recurse(ast.body), ';');
			break;
			
		case AST.Literal:
			return this.escape(ast.value);
	}
};

ASTCompiler.prototype.escape = function (value) {
	
	if (_.isString(value)) {
		
		return '\'' + value.replace(this.stringEscapeRegex, this.stringEscapeFn) + '\'';
	} else if (_.isNull(value)) {
		
		return 'null';
	} else {
		
		return value;
	}
};

ASTCompiler.prototype.stringEscapeRegex = /[^ a-zA-Z0-9]/g;

ASTCompiler.prototype.stringEscapeFn = function (c) {
	
	return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
};

function Parser (lexer) {
	
	this.lexer = lexer;
	this.ast = new AST(this.lexer);
	this.astCompiler = new ASTCompiler(this.ast);
}

Parser.prototype.parse = function (text) {
	
	return this.astCompiler.compile(text);
};

module.exports = parse;