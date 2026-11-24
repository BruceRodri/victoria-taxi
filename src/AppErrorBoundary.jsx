import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <main className="dispatch-main"><section className="panel">
      <h1>No se pudo abrir la pantalla</h1>
      <p>Tu cuenta puede haberse creado. Reintenta antes de volver a registrarte.</p>
      <button className="primary" onClick={() => window.location.reload()}>Reintentar</button>
      <button className="outline" onClick={() => {localStorage.removeItem("vt-session");localStorage.removeItem("vt-driver-submitted");window.location.reload();}}>Volver a iniciar sesión</button>
    </section></main>;
  }
}
