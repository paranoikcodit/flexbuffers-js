use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::Value;

#[napi]
pub struct FlexBuffer {
    data: Vec<u8>,
}

#[napi]
impl FlexBuffer {
    #[napi(constructor)]
    pub fn new() -> Self {
        Self { data: Vec::new() }
    }

    #[napi]
    pub fn serialize(&mut self, value: serde_json::Value) -> Result<()> {
        let mut builder = flexbuffers::Builder::default();

        self.serialize_value(&mut builder, &value)?;
        self.data = builder.take_buffer();
        Ok(())
    }

    #[napi]
    pub fn deserialize(&self) -> Result<serde_json::Value> {
        if self.data.is_empty() {
            return Err(Error::new(Status::InvalidArg, "Buffer is empty"));
        }

        let root = flexbuffers::Reader::get_root(&self.data[..])
            .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;

        self.deserialize_value(&root)
    }

    #[napi]
    pub fn get_buffer(&self) -> Vec<u8> {
        self.data.clone()
    }

    #[napi]
    pub fn from_buffer(buffer: Vec<u8>) -> Result<FlexBuffer> {
        let _ = flexbuffers::Reader::get_root(&buffer[..])
            .map_err(|e| Error::new(Status::InvalidArg, format!("Invalid flexbuffer: {}", e)))?;

        Ok(FlexBuffer { data: buffer })
    }

    #[napi]
    pub fn size(&self) -> u32 {
        self.data.len() as u32
    }

    fn serialize_value(&self, builder: &mut flexbuffers::Builder, value: &Value) -> Result<()> {
        match value {
            Value::Null => {
                builder.build_singleton(());
            }
            Value::Bool(b) => {
                builder.build_singleton(*b);
            }
            Value::Number(n) => {
                if let Some(i) = n.as_i64() {
                    builder.build_singleton(i);
                } else if let Some(f) = n.as_f64() {
                    builder.build_singleton(f);
                } else {
                    return Err(Error::new(Status::InvalidArg, "Invalid number"));
                }
            }
            Value::String(s) => {
                builder.build_singleton(s.as_str());
            }
            Value::Array(arr) => {
                let mut vec = builder.start_vector();
                for item in arr {
                    match item {
                        Value::Null => vec.push(()),
                        Value::Bool(b) => vec.push(*b),
                        Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                vec.push(i);
                            } else if let Some(f) = n.as_f64() {
                                vec.push(f);
                            }
                        }
                        Value::String(s) => vec.push(s.as_str()),
                        Value::Array(_) | Value::Object(_) => {
                            // For complex nested types, we need to serialize them recursively
                            // This is a limitation of the current flexbuffers 2.0 API
                            // For now, we'll convert them to strings as a workaround
                            let json_str = serde_json::to_string(item)
                                .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
                            vec.push(json_str.as_str());
                        }
                    }
                }
                vec.end_vector();
            }
            Value::Object(obj) => {
                let mut map = builder.start_map();
                for (key, val) in obj {
                    match val {
                        Value::Null => map.push(key.as_str(), ()),
                        Value::Bool(b) => map.push(key.as_str(), *b),
                        Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                map.push(key.as_str(), i);
                            } else if let Some(f) = n.as_f64() {
                                map.push(key.as_str(), f);
                            }
                        }
                        Value::String(s) => map.push(key.as_str(), s.as_str()),
                        Value::Array(_) | Value::Object(_) => {
                            // For complex nested types, serialize as JSON string for now
                            let json_str = serde_json::to_string(val)
                                .map_err(|e| Error::new(Status::GenericFailure, e.to_string()))?;
                            map.push(key.as_str(), json_str.as_str());
                        }
                    }
                }
                map.end_map();
            }
        }
        Ok(())
    }

    fn deserialize_value(&self, reader: &flexbuffers::Reader<&[u8]>) -> Result<Value> {
        match reader.flexbuffer_type() {
            flexbuffers::FlexBufferType::Null => Ok(Value::Null),
            flexbuffers::FlexBufferType::Bool => Ok(Value::Bool(reader.as_bool())),
            flexbuffers::FlexBufferType::Int | flexbuffers::FlexBufferType::UInt => {
                Ok(Value::Number(reader.as_i64().into()))
            }
            flexbuffers::FlexBufferType::Float => {
                let f = reader.as_f64();
                Ok(Value::Number(
                    serde_json::Number::from_f64(f).unwrap_or(0.into()),
                ))
            }
            flexbuffers::FlexBufferType::String => {
                let s = reader.as_str();
                // Try to parse as JSON first (for nested structures), fallback to string
                if let Ok(json_value) = serde_json::from_str::<Value>(s) {
                    match json_value {
                        Value::String(_) => Ok(Value::String(s.to_string())), // It was just a string
                        other => Ok(other), // It was a serialized structure
                    }
                } else {
                    Ok(Value::String(s.to_string()))
                }
            }
            flexbuffers::FlexBufferType::Vector
            | flexbuffers::FlexBufferType::VectorInt
            | flexbuffers::FlexBufferType::VectorUInt
            | flexbuffers::FlexBufferType::VectorFloat
            | flexbuffers::FlexBufferType::VectorBool
            | flexbuffers::FlexBufferType::VectorKey
            | flexbuffers::FlexBufferType::VectorString
            | flexbuffers::FlexBufferType::VectorInt2
            | flexbuffers::FlexBufferType::VectorInt3
            | flexbuffers::FlexBufferType::VectorInt4
            | flexbuffers::FlexBufferType::VectorUInt2
            | flexbuffers::FlexBufferType::VectorUInt3
            | flexbuffers::FlexBufferType::VectorUInt4
            | flexbuffers::FlexBufferType::VectorFloat2
            | flexbuffers::FlexBufferType::VectorFloat3
            | flexbuffers::FlexBufferType::VectorFloat4 => {
                let vec = reader.as_vector();
                let mut arr = Vec::new();
                for i in 0..vec.len() {
                    let item = vec.idx(i);
                    match self.deserialize_value(&item) {
                        Ok(val) => arr.push(val),
                        Err(_) => {} // Skip invalid items
                    }
                }
                Ok(Value::Array(arr))
            }
            flexbuffers::FlexBufferType::Map => {
                let map = reader.as_map();
                let mut obj = serde_json::Map::new();
                let keys_vec = map.keys_vector();

                for i in 0..map.len() {
                    let key = keys_vec.idx(i).as_str();
                    let val = map.idx(i);
                    match self.deserialize_value(&val) {
                        Ok(value) => {
                            obj.insert(key.to_string(), value);
                        }
                        Err(_) => {} // Skip invalid items
                    }
                }
                Ok(Value::Object(obj))
            }
            other => Err(Error::new(
                Status::GenericFailure,
                format!("Unsupported flexbuffer type: {:?}", other),
            )),
        }
    }
}

#[napi]
pub fn serialize(value: serde_json::Value) -> Result<Vec<u8>> {
    let mut fb = FlexBuffer::new();
    fb.serialize(value)?;
    Ok(fb.get_buffer())
}

#[napi]
pub fn deserialize(buffer: Vec<u8>) -> Result<serde_json::Value> {
    let fb = FlexBuffer::from_buffer(buffer)?;
    fb.deserialize()
}

#[napi]
pub fn is_valid_flexbuffer(buffer: Vec<u8>) -> bool {
    flexbuffers::Reader::get_root(&buffer[..]).is_ok()
}
