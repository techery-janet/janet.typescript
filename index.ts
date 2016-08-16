import * as RxJS from "rxjs"

namespace Janet {

    export enum ActionState {
        NotStarted,
        Running,
        Success,
        Error
    }

    export class ActionStateHolder<T> {
        state:ActionState;
        action:T;
        progress:number;
        error:Error;

        constructor(state:ActionState, action:T, progress:number = 0, error:Error = null) {
            this.state = state
            this.action = action
            this.progress = progress
            this.error = error
        }
    }

    export class ActionServiceCallback {
        pipeline:RxJS.Subject<ActionStateHolder<any>>;

        constructor(pipeline:RxJS.Subject<ActionStateHolder<any>>) {
            this.pipeline = pipeline;
        }

        onStart(action:any) {
            this.pipeline.next(new ActionStateHolder(ActionState.Running, action))
        }

        onProgress(action:any, progress:number) {
            this.pipeline.next(new ActionStateHolder(ActionState.Running, action, progress))
        }

        onSuccess(action:any) {
            this.pipeline.next(new ActionStateHolder(ActionState.Success, action, 1))
        }

        onError(action:any, error:Error) {
            this.pipeline.next(new ActionStateHolder(ActionState.Running, action, 0, error))
        }
    }

    export interface ActionService {
        setCallback(callback:ActionServiceCallback);
        accepts<T>(action:T) : boolean;
        execute<T>(action:T);
        cancel<T>(action:T);
    }

    export interface ReadActionPipe<T> {
        observe():RxJS.Observable<ActionStateHolder<T>>        
    }

    interface ActionSender<T> {
        (action:T):RxJS.Observable<ActionStateHolder<T>>        
    }

    interface ActionCanceler<T> {
        (action:T):void        
    }

    export class ActionPipe<T> implements ReadActionPipe<T> {
        
        pipeline:RxJS.Observable<any>;        
        sendAction:ActionSender<T>;
        cancelAction:ActionCanceler<T>;     

        constructor(
            pipeline:RxJS.Observable<ActionStateHolder<any>>,
            sendAction:ActionSender<T>,
            cancelAction:ActionCanceler<T>
            ) {
            this.pipeline = pipeline;
            this.sendAction = sendAction;
            this.cancelAction = cancelAction;
        }

        send(action:T) : RxJS.Observable<ActionStateHolder<T>> {
            return this.sendAction(action)
        }

        cancel(action:T) {
            this.cancelAction(action)
        }
        
        asReadOnly() : ReadActionPipe<T> {
            return this;
        }

        observe() : RxJS.Observable<ActionStateHolder<T>> {
            return this.pipeline;
        }
    }

    export interface PipeFactory {
        createPipe<T>():ActionPipe<T>        
    }

    export class Core implements PipeFactory {
        
        pipeline:RxJS.Subject<any> = new RxJS.Subject();
        services:Array<ActionService>;
        callback:ActionServiceCallback;

        constructor(...services:Array<ActionService>) {
            this.services = services

            this.callback = new ActionServiceCallback(this.pipeline)

            this.services.forEach((service) => {
                service.setCallback(this.callback)
            })
        }

        createPipe<T>():ActionPipe<T> {
            return new ActionPipe<T>(
                this.pipeline,
                this.sendAction.bind(this),
                this.cancelAction.bind(this)
            );
        }

        private sendAction<T>(action:T) : RxJS.Observable<ActionStateHolder<T>> {
            const service = this.findService(action);

            const actionObservable = this.pipeline.filter( (item) => {
                return item == action;
            });

            service.execute(action);

            return actionObservable;
        }

        private cancelAction<T>(action:T) {
            const service = this.findService(action);

            service.cancel(action);
        }

        private findService<T>(action:T) : ActionService {
            return this.services.filter((item) => {
                return item.accepts(action);
            })[0]
        }
    }
}

namespace JanetSample {

    class TestAction {

    }

    class TestService implements Janet.ActionService {
        callback:Janet.ActionServiceCallback

        setCallback(callback:Janet.ActionServiceCallback) {
            this.callback = callback
        }

        accepts<T>(action:T) : boolean {
            return action instanceof TestAction;
        }

        execute<T>(action:T) {

        }

        cancel<T>(action:T) {

        }
    }


    class LoginAction extends TestAction {
        public result:string
    }

    function main() {

        const testService = new TestService()

        const janet = new Janet.Core(testService)

        janet.createPipe<LoginAction>().observe().subscribe((state) => {
            console.log(state.action.result) 
        })
    }
}
