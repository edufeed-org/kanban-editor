export class RequestEditorDialogStore {
    public open = $state(false);

    public openDialog(): void {
        this.open = true;
    }

    public closeDialog(): void {
        this.open = false;
    }
}

export const requestEditorDialogStore = new RequestEditorDialogStore();
