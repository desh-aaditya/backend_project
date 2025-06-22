class ApiError extends Error{
    constructor(
        statusCode,
        message="Somethin went wrong",
        error=[],
        statck=""
    ){
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.error = error;
        this.data=null;
        this.success=false;
        
        if(statck){
            this.stack = statck;
        }else{
            Error.captureStackTrace(this, this.constructor);
        }
    }
}
export {ApiError};