// Estado compartido entre el marco (cabecera) y el área de la app.
// status: "loading" | "auth" | "phone" | "app"; authRender pinta el login o la vinculación del celular.
export const session = $state({ status: "loading", name: "", userId: null, authRender: null });
