FROM centos:centos7
LABEL author="detailyang" email="detailyang@gmail.com"

ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo
ENV PATH $CARGO_HOME/bin:$PATH

RUN yum update -y && \
    yum group install "Development Tools" -y && \
    yum clean all

RUN mkdir -p "$CARGO_HOME" && mkdir -p "$RUSTUP_HOME" && \
    curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable && \
    chmod -R a=rwX $CARGO_HOME