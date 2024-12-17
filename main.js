class ToioBLEController {
    constructor() {
        this.device = null;
        this.server = null;
        this.service = null;
        this.motorCharacteristic = null;
        this.isConnected = false;

        this.initializeElements();
        this.attachEventListeners();
        this.initializeTabs();
    }

    initializeElements() {
        this.connectBtn = document.getElementById('connectBtn');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.sendDataBtn = document.getElementById('sendDataBtn');
        this.addCoordinateBtn = document.getElementById('addCoordinateBtn');
        this.removeCoordinateBtn = document.getElementById('removeCoordinateBtn');
        this.coordinatesContainer = document.getElementById('coordinatesContainer');
        this.statusDiv = document.getElementById('status');
        this.dataSizeDiv = document.getElementById('dataSize');
        this.coordinateCountDiv = document.getElementById('coordinateCount');
    }

    attachEventListeners() {
        this.connectBtn.addEventListener('click', () => this.connect());
        this.disconnectBtn.addEventListener('click', () => this.disconnect());
        this.sendDataBtn.addEventListener('click', () => this.sendData());
        this.addCoordinateBtn.addEventListener('click', () => this.addCoordinateInput());
        this.removeCoordinateBtn.addEventListener('click', () => this.removeCoordinateInput());
    }

    initializeTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const tabId = button.getAttribute('data-tab');
                document.querySelectorAll('.data-preview-content').forEach(content => {
                    content.classList.remove('active');
                });
                if (tabId === 'raw') {
                    document.getElementById('rawDataPreview').classList.add('active');
                } else {
                    document.getElementById('parsedDataPreview').classList.add('active');
                }
            });
        });
    }

    async connect() {
        try {
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['10b20100-5b3b-4571-9508-cf3efcd7bbae'] }]
            });
            this.server = await this.device.gatt.connect();
            this.service = await this.server.getPrimaryService('10b20100-5b3b-4571-9508-cf3efcd7bbae');
            this.motorCharacteristic = await this.service.getCharacteristic('10b20102-5b3b-4571-9508-cf3efcd7bbae');

            this.isConnected = true;
            this.updateUIState(true);
            this.showStatus('接続成功', 'success');
        } catch (error) {
            this.showStatus('接続エラー: ' + error, 'error');
        }
    }

    async disconnect() {
        if (this.device && this.device.gatt.connected) {
            await this.device.gatt.disconnect();
            this.isConnected = false;
            this.updateUIState(false);
            this.showStatus('切断しました', 'success');
        }
    }

    updateUIState(connected) {
        this.connectBtn.textContent = connected ? 'toioに接続中' : 'toioに接続';
        this.connectBtn.classList.toggle('connected', connected);
        this.disconnectBtn.disabled = !connected;
        this.sendDataBtn.disabled = !connected;
    }

    async sendData() {
        if (!this.motorCharacteristic) {
            this.showStatus('先にtoioに接続してください', 'error');
            return;
        }

        const data = this.generateData();
        const dataSize = this.calculateDataSize(data);
        this.updateDataSize(dataSize);

        try {
            await this.motorCharacteristic.writeValue(new Uint8Array(data));
            this.showStatus(`${(data.length - 8) / 6}個の座標を送信しました`, 'success');
        } catch (error) {
            this.showStatus('送信エラー: ' + error, 'error');
        }
    }

    generateData() {
        const data = [
            0x04, // 制御の種類 (複数目標指定付きモーター制御)
            0x00, // 制御識別値
            0x05, // タイムアウト時間 (5秒)
            0x02, // 移動タイプ (回転しながら移動)
            0x50, // モーターの最大速度指示値
            0x00, // モーターの速度変化タイプ (速度一定)
            0x00, // Reserved
            0x00  // 書き込み操作の追加設定 (上書き)
        ];

        const inputs = this.coordinatesContainer.getElementsByClassName('coordinate-input');
        for (let input of inputs) {
            const x = parseInt(input.querySelector('input[id^="x"]').value) || 0;
            const y = parseInt(input.querySelector('input[id^="y"]').value) || 0;
            const angle = parseInt(input.querySelector('input[id^="angle"]').value) || 0;

            data.push(x & 0xFF, (x >> 8) & 0xFF);
            data.push(y & 0xFF, (y >> 8) & 0xFF);
            data.push(angle & 0xFF, (angle >> 8) & 0xFF);
        }

        this.updateDataPreview(data);

        return data;
    }

    calculateDataSize(data) {
        return data.length;
    }

    showStatus(message, type) {
        this.statusDiv.textContent = message;
        this.statusDiv.className = type;
    }

    updateDataSize(size) {
        this.dataSizeDiv.textContent = `${size} バイト`;
    }

    addCoordinateInput() {
        const inputs = this.coordinatesContainer.getElementsByClassName('coordinate-input');
        const newIndex = inputs.length + 1;

        const newInput = document.createElement('div');
        newInput.className = 'coordinate-input';
        newInput.innerHTML = `
            <label for="x${newIndex}">X座標:</label>
            <input type="number" id="x${newIndex}" placeholder="X" min="0" max="65535">
            <label for="y${newIndex}">Y座標:</label>
            <input type="number" id="y${newIndex}" placeholder="Y" min="0" max="65535">
            <label for="angle${newIndex}">角度:</label>
            <input type="number" id="angle${newIndex}" placeholder="角度" min="0" max="65535">
        `;
        this.coordinatesContainer.appendChild(newInput);
        this.coordinateCountDiv.textContent = newIndex;
    }

    removeCoordinateInput() {
        const inputs = this.coordinatesContainer.getElementsByClassName('coordinate-input');
        if (inputs.length > 1) {
            this.coordinatesContainer.removeChild(inputs[inputs.length - 1]);
            this.coordinateCountDiv.textContent = inputs.length - 1;
        }
    }

    updateDataPreview(data) {
        // 生データの更新
        const headerBytes = document.getElementById('headerBytes');
        const coordinateBytes = document.getElementById('coordinateBytes');

        const header = data.slice(0, 8);
        const coordinates = data.slice(8);

        headerBytes.textContent = this.formatBytes(header);
        coordinateBytes.textContent = this.formatBytes(coordinates);

        // 解析データの更新
        const parsedData = document.getElementById('parsedData');
        parsedData.innerHTML = this.generateParsedDataHTML(data);
    }

    formatBytes(bytes) {
        return Array.from(bytes)
            .map(byte => '0x' + byte.toString(16).padStart(2, '0'))
            .join(' ');
    }

    generateParsedDataHTML(data) {
        const controlTypes = {
            0x04: '複数目標指定付きモーター制御'
        };

        const moveTypes = {
            0x00: '回転しながら移動',
            0x02: '回転しながら移動'
        };

        const speedChangeTypes = {
            0x00: '速度一定'
        };

        const writeTypes = {
            0x00: '上書き',
            0x01: '追加'
        };

        let html = `
            <div class="field">
                <span class="field-name">制御の種類:</span> ${controlTypes[data[0]] || `不明(0x${data[0].toString(16)})`}
            </div>
            <div class="field">
                <span class="field-name">制御識別値:</span> ${data[1]}
            </div>
            <div class="field">
                <span class="field-name">タイムアウト時間:</span> ${data[2]}秒
            </div>
            <div class="field">
                <span class="field-name">移動タイプ:</span> ${moveTypes[data[3]] || `不明(0x${data[3].toString(16)})`}
            </div>
            <div class="field">
                <span class="field-name">最大速度:</span> ${data[4]}
            </div>
            <div class="field">
                <span class="field-name">速度変化タイプ:</span> ${speedChangeTypes[data[5]] || `不明(0x${data[5].toString(16)})`}
            </div>
            <div class="field">
                <span class="field-name">書き込み操作:</span> ${writeTypes[data[7]] || `不明(0x${data[7].toString(16)})`}
            </div>
        `;

        // 座標データの解析
        const coordData = data.slice(8);
        const coordCount = coordData.length / 6;

        for (let i = 0; i < coordCount; i++) {
            const offset = i * 6;
            const x = coordData[offset] | (coordData[offset + 1] << 8);
            const y = coordData[offset + 2] | (coordData[offset + 3] << 8);
            const angle = coordData[offset + 4] | (coordData[offset + 5] << 8);

            html += `
                <div class="coordinate-point">
                    <div class="field">目標地点 ${i + 1}</div>
                    <div class="field">X座標: ${x}</div>
                    <div class="field">Y座標: ${y}</div>
                    <div class="field">角度: ${angle}度</div>
                </div>
            `;
        }

        return html;
    }
}

// Initialize the controller when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.controller = new ToioBLEController();
});