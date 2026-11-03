/**
 * CSInterface - Communication between CEP HTML and ExtendScript
 * Simplified version with essential functions
 */

var CSInterface = (function() {
    'use strict';
    
    function CSInterface() {
        this.hostEnvironment = this.getHostEnvironment();
    }
    
    /**
     * Executes ExtendScript and returns result
     */
    CSInterface.prototype.evalScript = function(script, callback) {
        if (callback === null || callback === undefined) {
            callback = function(result) {};
        }
        
        window.__adobe_cep__.evalScript(script, callback);
    };
    
    /**
     * Gets host environment information
     */
    CSInterface.prototype.getHostEnvironment = function() {
        try {
            var envJSON = window.__adobe_cep__.getHostEnvironment();
            return JSON.parse(envJSON);
        } catch (e) {
            return null;
        }
    };
    
    /**
     * Gets system path
     */
    CSInterface.prototype.getSystemPath = function(pathType) {
        var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
        return path;
    };
    
    /**
     * Opens a URL in the default browser
     */
    CSInterface.prototype.openURLInDefaultBrowser = function(url) {
        window.__adobe_cep__.openURLInDefaultBrowser(url);
    };
    
    /**
     * Gets extension path
     */
    CSInterface.prototype.getExtensionPath = function() {
        return decodeURI(window.__adobe_cep__.getSystemPath('extension'));
    };
    
    /**
     * Dispatches a CEP event
     */
    CSInterface.prototype.dispatchEvent = function(event) {
        if (typeof event.data === 'object') {
            event.data = JSON.stringify(event.data);
        }
        
        window.__adobe_cep__.dispatchEvent(event);
    };
    
    /**
     * Adds an event listener
     */
    CSInterface.prototype.addEventListener = function(type, listener, obj) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    };
    
    /**
     * Removes an event listener
     */
    CSInterface.prototype.removeEventListener = function(type, listener, obj) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    };
    
    /**
     * Sets window size
     */
    CSInterface.prototype.resizeContent = function(width, height) {
        window.resizeTo(width, height);
    };
    
    /**
     * Closes the extension
     */
    CSInterface.prototype.closeExtension = function() {
        window.__adobe_cep__.closeExtension();
    };
    
    /**
     * Gets OS information
     */
    CSInterface.prototype.getOSInformation = function() {
        var OSVersion = window.__adobe_cep__.getOSInformation();
        return OSVersion;
    };
    
    return CSInterface;
})();