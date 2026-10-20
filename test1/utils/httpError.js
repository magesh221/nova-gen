// HttpError class for standardized HTTP error responses
export class HttpError extends Error {
    constructor(statusCode, message, code) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.code = code;
    }
}
