// Opt-in preview; normal URLs retain the verified v4 build.
window.TERMINAL_ENGINE_V5=new URL(location.href).searchParams.get('engine')==='v5';
document.write('<script src="'+(window.TERMINAL_ENGINE_V5?'vendor/lightweight-charts-5.3.0/lightweight-charts.standalone.production.js':'js/lightweight-charts.standalone.production.js')+'"><\/script>');
