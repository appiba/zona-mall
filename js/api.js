(function () {
  let counter = 0;

  function call(method, payload) {
    return new Promise((resolve, reject) => {
      const apiUrl = window.ZonarConfig && window.ZonarConfig.apiUrl;
      if (!apiUrl || apiUrl.includes('URL_DEL_APPS_SCRIPT')) {
        reject(new Error('API_URL no esta configurada'));
        return;
      }

      const callbackName = `__zonarApiCallback_${Date.now()}_${counter += 1}`;
      const params = new URLSearchParams({
        action: method,
        callback: callbackName
      });

      if (payload !== undefined) {
        params.set('payload', JSON.stringify(payload));
      }

      const script = document.createElement('script');
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Tiempo agotado llamando ${method}`));
      }, 30000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (response) => {
        cleanup();
        if (response && response.ok) {
          resolve(response.data);
        } else {
          reject(new Error((response && response.error) || `Error llamando ${method}`));
        }
      };

      script.onerror = () => {
        cleanup();
        reject(new Error(`No se pudo conectar con Apps Script para ${method}`));
      };

      script.src = `${apiUrl}?${params.toString()}`;
      document.head.append(script);
    });
  }

  window.ZonarAPI = { call };
}());
